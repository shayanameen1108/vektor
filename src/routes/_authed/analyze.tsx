import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircleIcon,
  FileDownIcon,
  FileTextIcon,
  PaperclipIcon,
  XCircleIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { GoNoGoGauge } from "@/components/go-nogo-gauge";

import { apiForm, apiSend, qk, type ReturnableState, type Tender } from "@/lib/api-client";
import { companiesQuery, creditsQuery, tenderQuery, tendersQuery } from "@/lib/queries";
import { downloadAuthenticatedFile, downloadSbdForm, type SbdForm } from "@/lib/download";
import { maxBbbeePoints } from "@/lib/bbbee";
import { formatDate } from "@/lib/date";
import { CompanySelect } from "@/components/company-select";
import { NoCompanyPage } from "@/components/no-company-page";
import { PageHeader } from "@/components/page-header";
import { PageState } from "@/components/page-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useActiveCompany } from "@/hooks/use-active-company";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@/components/ui/attachment";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";

export const Route = createFileRoute("/_authed/analyze")({
  validateSearch: (search: Record<string, unknown>): { tender?: string } => {
    const tender =
      typeof search.tender === "string" && search.tender.length > 0 ? search.tender : undefined;
    return tender ? { tender } : {};
  },
  component: AnalyzePage,
});

interface TenderResult {
  tender_id: string;
  tender_title: string;
  required_cidb: string | null;
  mandatory_returnables: string[];
  evaluation_criteria?: string[];
  fit_score: number;
  risk_flags: string[];
  eligible_bbbee_points: number;
  preference_point_system?: string | null;
  closing_date: string | null;
  returnable_status: Record<
    string,
    { verified: boolean; verified_at: string | null; doc_ref: string | null }
  >;
}

function stringsOf(value: unknown[]): string[] {
  return value.filter((item): item is string => typeof item === "string");
}

function tenderToResult(tender: Tender): TenderResult {
  return {
    tender_id: tender.id,
    tender_title: tender.title,
    required_cidb: tender.required_cidb_grade,
    mandatory_returnables: stringsOf(tender.parsed_returnables),
    evaluation_criteria: stringsOf(tender.evaluation_criteria),
    fit_score: tender.fit_score,
    risk_flags: stringsOf(tender.risk_flags),
    eligible_bbbee_points: tender.eligible_bbbee_points,
    preference_point_system: tender.preference_point_system,
    closing_date: tender.closing_date,
    returnable_status: tender.returnable_status,
  };
}

function AnalyzePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const companiesQueryResult = useQuery(companiesQuery());
  const companies = companiesQueryResult.data ?? [];
  const {
    company: selectedCompany,
    selectedId: selectedCompanyId,
    setSelectedId,
  } = useActiveCompany(companies);
  const [preferenceSystem, setPreferenceSystem] = useState("80/20");
  const [preferenceSeededFromId, setPreferenceSeededFromId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<TenderResult | null>(null);
  const [seededTenderId, setSeededTenderId] = useState<string | null>(null);
  const [sbdBusy, setSbdBusy] = useState<string | null>(null);
  const [returnableStatus, setReturnableStatus] = useState<Record<string, ReturnableState>>({});

  // Seed / re-seed the PPPFA default whenever the active company changes
  // (render-phase adjustment — the documented React pattern for resetting
  // editable state when its source changes).
  if (selectedCompany && selectedCompany.id !== preferenceSeededFromId) {
    setPreferenceSeededFromId(selectedCompany.id);
    setPreferenceSystem(selectedCompany.preferred_pppfa_system ?? "80/20");
  }

  const companyId = selectedCompany?.id;
  const tendersQueryResult = useQuery({ ...tendersQuery(companyId!), enabled: Boolean(companyId) });
  const tenderList = tendersQueryResult.data ?? [];
  const historicTenderId = search.tender;
  const historicQuery = useQuery({
    ...tenderQuery(historicTenderId ?? ""),
    enabled: Boolean(historicTenderId),
  });

  // Only seed from the tender named in the URL — cached `data` from a previous
  // `?tender=` must not overwrite a just-finished analysis.
  if (
    historicTenderId &&
    historicQuery.data &&
    historicQuery.data.id === historicTenderId &&
    historicQuery.data.id !== seededTenderId
  ) {
    setSeededTenderId(historicQuery.data.id);
    setResult(tenderToResult(historicQuery.data));
    setReturnableStatus(historicQuery.data.returnable_status ?? {});
    if (historicQuery.data.preference_point_system) {
      setPreferenceSystem(historicQuery.data.preference_point_system);
    }
  }

  const analyzeMutation = useMutation({
    mutationFn: (form: FormData) => apiForm<TenderResult>("/api/tenders/analyze", form),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tendersQuery(companyId!).queryKey }),
        queryClient.invalidateQueries({ queryKey: creditsQuery(companyId!).queryKey }),
        queryClient.invalidateQueries({ queryKey: qk.activityPrefix }),
      ]);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    if (selectedFile && !selectedFile.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are supported");
      e.target.value = "";
      return;
    }
    setFile(selectedFile);
  };

  async function handleAnalyze() {
    if (!file || !selectedCompany) return;
    // Drop `?tender=` before clearing state so the historic seed cannot
    // write the previous analysis back over this run.
    if (historicTenderId) {
      await navigate({ to: "/analyze", search: {}, replace: true });
    }
    setResult(null);
    setSeededTenderId(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("company_id", selectedCompany.id);
      formData.append("preference_system", preferenceSystem);
      const data = await analyzeMutation.mutateAsync(formData);
      setSeededTenderId(data.tender_id);
      setResult(data);
      setReturnableStatus(data.returnable_status ?? {});
      await navigate({ to: "/analyze", search: { tender: data.tender_id }, replace: true });
      toast.success("Tender analyzed successfully!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to analyze tender");
    }
  }

  // Keep the cached single-tender and list views in sync with the server's
  // authoritative returnable state — reopening a recent analysis inside the
  // query staleTime must not show stale checkboxes.
  const refreshTenderViews = (tenderId: string) => {
    void queryClient.invalidateQueries({ queryKey: tenderQuery(tenderId).queryKey });
    if (companyId) {
      void queryClient.invalidateQueries({ queryKey: tendersQuery(companyId).queryKey });
    }
  };

  const toggleReturnable = async (name: string, current: boolean) => {
    if (!result?.tender_id) return;
    const nextVerified = !current;
    const previous = returnableStatus[name];
    // optimistic
    setReturnableStatus((prev) => ({
      ...prev,
      [name]: {
        verified: nextVerified,
        verified_at: nextVerified ? new Date().toISOString() : null,
        doc_ref: prev[name]?.doc_ref ?? null,
        file_name: prev[name]?.file_name ?? null,
      },
    }));
    try {
      const data = await apiSend<{ returnable_status: Record<string, ReturnableState> }>(
        "POST",
        `/api/tender/${result.tender_id}/returnables/toggle`,
        { returnable_name: name, verified: nextVerified },
      );
      setReturnableStatus(data.returnable_status);
      refreshTenderViews(result.tender_id);
    } catch (e) {
      // revert on failure (including the original verified_at)
      setReturnableStatus((prev) => ({
        ...prev,
        [name]: previous ?? { verified: false, verified_at: null, doc_ref: null },
      }));
      toast.error(e instanceof Error ? e.message : "Failed to update returnable");
    }
  };

  const handleDownloadOriginal = async (tenderId: string) => {
    try {
      await downloadAuthenticatedFile(
        `/api/tenders/download/${tenderId}`,
        `tender-${tenderId}.pdf`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Original tender PDF not available");
    }
  };

  const uploadReturnable = async (name: string, file: File) => {
    if (!result?.tender_id) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("returnable_name", name);
    try {
      const data = await apiForm<{ returnable_status: Record<string, ReturnableState> }>(
        `/api/tender/${result.tender_id}/returnables/upload`,
        fd,
      );
      setReturnableStatus(data.returnable_status);
      refreshTenderViews(result.tender_id);
      toast.success(`${file.name} attached to "${name}"`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to attach file");
    }
  };

  const downloadSbd = async (tenderId: string, form: SbdForm) => {
    setSbdBusy(`${tenderId}-${form}`);
    try {
      await downloadSbdForm(tenderId, form);
    } finally {
      setSbdBusy(null);
    }
  };

  const openHistoric = (tenderId: string) => {
    setResult(null);
    setSeededTenderId(null);
    void navigate({ to: "/analyze", search: { tender: tenderId } });
  };

  const loading = analyzeMutation.isPending;

  // A failed background refetch keeps cached data — only blank the page when
  // there is nothing cached to render.
  if (
    companiesQueryResult.isPending ||
    (companiesQueryResult.isError && !companiesQueryResult.data)
  ) {
    return (
      <PageState
        status={companiesQueryResult.isError ? "error" : "loading"}
        message="Could not load your companies."
        errorTestId="analyze-companies-error"
        retryTestId="analyze-companies-retry"
        onRetry={() => void companiesQueryResult.refetch()}
      />
    );
  }

  if (!companies.length) {
    return (
      <NoCompanyPage
        overline="Analyze"
        title="Tender Analysis"
        titleTestId="analyze-title"
        description="Upload a tender PDF for automated compliance audit and risk scoring."
        testId="no-company-message"
      />
    );
  }

  if (tendersQueryResult.isPending || (tendersQueryResult.isError && !tendersQueryResult.data)) {
    return (
      <PageState
        status={tendersQueryResult.isError ? "error" : "loading"}
        message="Could not load your tender history."
        errorTestId="analyze-tenders-error"
        retryTestId="analyze-tenders-retry"
        onRetry={() => void tendersQueryResult.refetch()}
      />
    );
  }

  return (
    <div className="flex-1 bg-background">
      <PageHeader
        overline="Analyze"
        title="Tender Analysis"
        titleTestId="analyze-title"
        description="Upload a tender PDF for automated compliance audit and risk scoring."
      />

      <div className="p-6 sm:p-8">
        <Card className="mb-8" data-testid="upload-card">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-xl font-bold">Upload Tender Document</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {companies.length > 1 && (
                <div data-testid="company-picker-wrapper">
                  <CompanySelect
                    companies={companies}
                    value={selectedCompanyId ?? ""}
                    onValueChange={setSelectedId}
                    label="Company Profile"
                    className="max-w-sm"
                  />
                </div>
              )}
              {companies.length === 1 && selectedCompany && (
                <Field data-testid="profile-card">
                  <FieldLabel className="label-caps">Company Profile</FieldLabel>
                  <Item
                    variant="outline"
                    className="mt-2 w-full"
                    render={
                      <button
                        type="button"
                        data-testid="profile-card-link"
                        aria-label={`Edit ${selectedCompany.company_name} profile`}
                        onClick={() => void navigate({ to: "/setup" })}
                      />
                    }
                  >
                    <ItemContent>
                      <ItemTitle>{selectedCompany.company_name}</ItemTitle>
                      <ItemDescription>
                        B-BBEE Level{" "}
                        {selectedCompany.bbbee_level != null ? (
                          <span className="font-semibold text-foreground">
                            {selectedCompany.bbbee_level}
                          </span>
                        ) : (
                          <span className="font-semibold text-status-warning">Not set</span>
                        )}{" "}
                        • CIDB{" "}
                        {selectedCompany.cidb_crs_num ? (
                          <span className="font-semibold text-foreground">
                            {selectedCompany.cidb_crs_num}
                          </span>
                        ) : (
                          <span className="font-semibold text-status-warning">Not set</span>
                        )}
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                </Field>
              )}

              <Field>
                <FieldLabel className="label-caps">PPPFA Preference System</FieldLabel>
                <RadioGroup
                  value={preferenceSystem}
                  onValueChange={(value) => setPreferenceSystem(value ?? "80/20")}
                  className="mt-2 grid gap-2"
                  data-testid="select-pppfa-system"
                  aria-label="Preference system"
                >
                  <FieldLabel
                    htmlFor="pppfa-80-20"
                    className="flex w-full items-center gap-2 rounded-sm border border-border px-3 py-2 text-sm font-normal normal-case tracking-normal"
                  >
                    <RadioGroupItem id="pppfa-80-20" value="80/20" />
                    80/20 System (Standard)
                  </FieldLabel>
                  <FieldLabel
                    htmlFor="pppfa-90-10"
                    className="flex w-full items-center gap-2 rounded-sm border border-border px-3 py-2 text-sm font-normal normal-case tracking-normal"
                  >
                    <RadioGroupItem id="pppfa-90-10" value="90/10" />
                    90/10 System (Above R50M)
                  </FieldLabel>
                </RadioGroup>
              </Field>

              <Field>
                <FieldLabel className="label-caps">Tender PDF Document</FieldLabel>
                <div className="mt-2">
                  <input
                    ref={fileInputRef}
                    id="file-upload"
                    data-testid="file-input"
                    type="file"
                    accept=".pdf"
                    className="sr-only"
                    aria-label="Tender PDF document"
                    onChange={handleFileChange}
                  />
                  <Attachment
                    state={file ? "done" : "idle"}
                    className="w-full max-w-none"
                    data-testid={file ? "selected-tender-file" : "file-upload-area"}
                  >
                    <AttachmentMedia>
                      <FileTextIcon aria-hidden="true" />
                    </AttachmentMedia>
                    <AttachmentContent>
                      <AttachmentTitle data-testid={file ? "selected-file-name" : undefined}>
                        {file ? file.name : "Click to upload PDF"}
                      </AttachmentTitle>
                      <AttachmentDescription>
                        {file
                          ? `PDF · ${(file.size / 1024).toFixed(0)} KB`
                          : "Only PDF tender packs supported"}
                      </AttachmentDescription>
                    </AttachmentContent>
                    {file ? (
                      <AttachmentActions>
                        <AttachmentAction
                          aria-label={`Remove ${file.name}`}
                          data-testid="remove-tender-file"
                          onClick={() => {
                            setFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                        >
                          <XCircleIcon aria-hidden="true" />
                        </AttachmentAction>
                      </AttachmentActions>
                    ) : (
                      <AttachmentTrigger
                        render={
                          <label htmlFor="file-upload" aria-label="Upload tender PDF">
                            <span className="sr-only">Upload tender PDF</span>
                          </label>
                        }
                      />
                    )}
                  </Attachment>
                </div>
              </Field>

              <Button
                data-testid="analyze-btn"
                onClick={handleAnalyze}
                disabled={loading || !file}
                size="lg"
                className="w-full"
                aria-busy={loading}
              >
                {loading ? (
                  <>
                    <Spinner className="h-4 w-4" aria-hidden="true" />
                    Analyzing Tender…
                  </>
                ) : (
                  "Run Compliance Audit"
                )}
              </Button>

              {tenderList.length > 0 && (
                <div className="pt-4 border-t border-border" data-testid="tender-list-section">
                  <h2 className="label-caps text-muted-foreground">Recent Tenders</h2>
                  <ul className="mt-3 space-y-2">
                    {tenderList.slice(0, 5).map((t) => (
                      <li key={t.id} data-testid={`tender-list-item-${t.id}`}>
                        <Item variant="outline">
                          <ItemContent>
                            <ItemTitle>
                              <Button
                                type="button"
                                variant="link"
                                size="xs"
                                data-testid={`open-tender-${t.id}`}
                                onClick={() => openHistoric(t.id)}
                                className="h-auto w-full justify-start px-0 py-1 text-left whitespace-normal break-words text-foreground"
                              >
                                {t.title ?? "Untitled"}
                              </Button>
                            </ItemTitle>
                            <ItemDescription>
                              {[
                                t.fit_score != null ? `${t.fit_score}%` : null,
                                t.required_cidb_grade,
                              ]
                                .filter(Boolean)
                                .join(" • ") || "—"}
                            </ItemDescription>
                          </ItemContent>
                          <ItemActions className="flex-wrap">
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              data-testid={`sbd4-btn-${t.id}`}
                              disabled={sbdBusy === `${t.id}-sbd4`}
                              onClick={() => void downloadSbd(t.id, "sbd4")}
                              aria-label={`Download SBD 4 for ${t.title ?? t.id}`}
                            >
                              {sbdBusy === `${t.id}-sbd4` ? <Spinner className="h-3 w-3" /> : null}
                              SBD 4
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              data-testid={`sbd61-btn-${t.id}`}
                              disabled={sbdBusy === `${t.id}-sbd61`}
                              onClick={() => void downloadSbd(t.id, "sbd61")}
                              aria-label={`Download SBD 6.1 for ${t.title ?? t.id}`}
                            >
                              {sbdBusy === `${t.id}-sbd61` ? <Spinner className="h-3 w-3" /> : null}
                              SBD 6.1
                            </Button>
                          </ItemActions>
                        </Item>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {historicTenderId && historicQuery.isError ? (
          <Alert className="mb-6" data-testid="historic-tender-error">
            <AlertDescription className="flex flex-wrap items-center gap-3">
              Could not load that analysis.
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="historic-tender-retry"
                onClick={() => void historicQuery.refetch()}
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {historicTenderId && historicQuery.isPending && !result ? (
          <div className="mb-6 flex justify-center p-8">
            <Spinner className="h-6 w-6 text-muted-foreground" />
          </div>
        ) : null}

        {result && (
          <div className="space-y-6" data-testid="results-section">
            <Card data-testid="fit-score-card">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-xl font-bold">Go / No-Go Analysis</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex-shrink-0">
                    <GoNoGoGauge score={result.fit_score} />
                  </div>
                  <div className="flex-1 space-y-4 md:border-l md:border-border md:pl-6 w-full">
                    <div data-testid="bbbee-points-block">
                      <p className="label-caps text-muted-foreground mb-1">
                        B-BBEE Preference Points
                      </p>
                      <div className="text-4xl font-bold" data-testid="bbbee-points-value">
                        {result.eligible_bbbee_points}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        out of {maxBbbeePoints(result.preference_point_system)} points
                      </p>
                    </div>
                    <div data-testid="risk-flags-summary">
                      <p className="label-caps text-muted-foreground mb-1">Risk Flags</p>
                      <div className="text-4xl font-bold" data-testid="risk-flags-count">
                        {result.risk_flags.length}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {result.risk_flags.length === 0 ? "all clear" : "issues to review"}
                      </p>
                    </div>
                    <div data-testid="fit-score-summary">
                      <p className="label-caps text-muted-foreground mb-1">Fit Score</p>
                      <div className="text-2xl font-bold" data-testid="fit-score-value">
                        {result.fit_score} / 100
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="tender-details-card">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-xl font-bold">Tender Details</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <p className="label-caps text-muted-foreground">Tender Title</p>
                    <p className="font-semibold mt-1" data-testid="tender-title-value">
                      {result.tender_title}
                    </p>
                    {result.tender_id && (
                      <Button
                        type="button"
                        variant="link"
                        size="xs"
                        data-testid="download-original-pdf-btn"
                        onClick={() => void handleDownloadOriginal(result.tender_id!)}
                        className="mt-2 h-auto justify-start px-0 py-1 text-left"
                      >
                        <FileDownIcon aria-hidden="true" />
                        Download original PDF
                      </Button>
                    )}
                  </div>
                  {result.required_cidb && (
                    <div>
                      <p className="label-caps text-muted-foreground">Required CIDB Grade</p>
                      <p className="font-semibold mt-1" data-testid="required-cidb-value">
                        {result.required_cidb}
                      </p>
                    </div>
                  )}
                  {result.closing_date && (
                    <div>
                      <p className="label-caps text-muted-foreground">Closing Date</p>
                      <p className="font-semibold mt-1" data-testid="closing-date-value">
                        {formatDate(result.closing_date)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {result.evaluation_criteria && result.evaluation_criteria.length > 0 && (
              <Card data-testid="evaluation-criteria-card">
                <CardHeader className="border-b border-border">
                  <CardTitle className="text-xl font-bold">Evaluation Criteria</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Structured scoring as extracted by AI — verify against the tender document.
                  </p>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="space-y-2" data-testid="evaluation-criteria-list">
                    {result.evaluation_criteria.map((c, idx) => (
                      <li
                        key={`${idx}-${c.slice(0, 20)}`}
                        data-testid={`evaluation-criteria-${idx}`}
                        className="flex items-start gap-2 text-sm text-foreground"
                      >
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground shrink-0" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Card data-testid="returnables-card">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-xl font-bold">Submission Checklist</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Track your progress as you gather each required document.
                </p>
              </CardHeader>
              <CardContent className="pt-6">
                {result.mandatory_returnables.length === 0 ? (
                  <p className="text-muted-foreground">No specific returnables detected</p>
                ) : (
                  <ul className="space-y-3" data-testid="returnables-list">
                    {result.mandatory_returnables.map((name) => {
                      const status = returnableStatus[name] ?? {
                        verified: false,
                        verified_at: null,
                        doc_ref: null,
                      };
                      return (
                        <li
                          key={name}
                          className="flex flex-col gap-3 p-3 rounded-sm border border-border sm:flex-row sm:items-center"
                          data-testid={`returnable-row-${name.replace(/[^a-zA-Z0-9]/g, "_")}`}
                        >
                          <Checkbox
                            checked={status.verified}
                            onCheckedChange={() => void toggleReturnable(name, status.verified)}
                            data-testid={`returnable-toggle-${name.replace(/[^a-zA-Z0-9]/g, "_")}`}
                            aria-label={`Mark ${name} as ${status.verified ? "missing" : "included"}`}
                          />
                          <span
                            className={`flex-1 text-sm break-words min-w-0 ${status.verified ? "font-semibold text-foreground" : "text-foreground"}`}
                          >
                            {name}
                          </span>
                          <label
                            htmlFor={`returnable-file-${name.replace(/[^a-zA-Z0-9]/g, "_")}`}
                            className={buttonVariants({ variant: "outline", size: "xs" })}
                            title="Attach a supporting file"
                          >
                            <PaperclipIcon aria-hidden="true" />
                            {status.file_name ? (
                              <span className="max-w-24 truncate">{status.file_name}</span>
                            ) : (
                              "Attach"
                            )}
                          </label>
                          <input
                            id={`returnable-file-${name.replace(/[^a-zA-Z0-9]/g, "_")}`}
                            type="file"
                            className="sr-only"
                            tabIndex={-1}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void uploadReturnable(name, f);
                              e.target.value = "";
                            }}
                            data-testid={`returnable-upload-${name.replace(/[^a-zA-Z0-9]/g, "_")}`}
                            aria-label={`Attach supporting file for ${name}`}
                          />
                          <span
                            className={`label-caps ${status.verified ? "text-status-success" : "text-muted-foreground"}`}
                            data-testid={`returnable-status-${name.replace(/[^a-zA-Z0-9]/g, "_")}`}
                          >
                            {status.verified ? "Included" : "Missing"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card data-testid="risk-flags-card">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-xl font-bold">Compliance Risk Alerts</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {result.risk_flags.length === 0 ? (
                  <Alert
                    className="border-status-success/25 bg-status-success/10"
                    data-testid="risk-flags-empty"
                  >
                    <AlertDescription className="font-semibold text-status-success">
                      No disqualification risks detected. All compliance checks passed.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <ul className="space-y-3" data-testid="risk-flags-list">
                    {result.risk_flags.map((flag, idx) => (
                      <li key={`${idx}-${flag.slice(0, 30)}`} data-testid={`risk-flag-${idx}`}>
                        <Alert
                          className={`rounded-sm ${
                            flag.includes("CRITICAL")
                              ? "border-destructive/25 bg-destructive/10"
                              : "border-status-warning/25 bg-status-warning/10"
                          }`}
                        >
                          {flag.includes("CRITICAL") ? (
                            <XCircleIcon className="text-destructive" aria-hidden="true" />
                          ) : (
                            <AlertCircleIcon className="text-status-warning" aria-hidden="true" />
                          )}
                          <AlertDescription
                            className={`font-medium ${flag.includes("CRITICAL") ? "text-destructive" : "text-status-warning"}`}
                          >
                            {flag}
                          </AlertDescription>
                        </Alert>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="sbd-downloads">
              <Button
                data-testid="download-sbd4-btn"
                onClick={() => void downloadSbd(result.tender_id, "sbd4")}
                disabled={sbdBusy === `${result.tender_id}-sbd4`}
                size="lg"
                className="h-16 justify-start px-6"
              >
                <FileDownIcon className="size-5" aria-hidden="true" />
                <span className="text-left">
                  <span className="block font-bold">Download SBD 4</span>
                  <span className="block text-xs opacity-80">Declaration of Interest</span>
                </span>
              </Button>
              <Button
                data-testid="download-sbd61-btn"
                onClick={() => void downloadSbd(result.tender_id, "sbd61")}
                disabled={sbdBusy === `${result.tender_id}-sbd61`}
                size="lg"
                className="h-16 justify-start px-6"
              >
                <FileDownIcon className="size-5" aria-hidden="true" />
                <span className="text-left">
                  <span className="block font-bold">Download SBD 6.1</span>
                  <span className="block text-xs opacity-80">Preference Points Claim</span>
                </span>
              </Button>
            </div>

            <Button
              data-testid="view-dashboard-btn"
              render={<Link to="/app" />}
              variant="outline"
              size="lg"
              className="w-full"
            >
              View All Tenders on Dashboard
            </Button>
          </div>
        )}

        {!result && !historicTenderId && tenderList.length === 0 && (
          <Empty
            className="border border-solid border-border bg-card p-8"
            data-testid="empty-state"
          >
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileTextIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No analysis yet</EmptyTitle>
              <EmptyDescription>
                Upload a tender PDF above to see your Go / No-Go score. Scoring uses your
                company&apos;s compliance vault, CIDB grades, and bargaining council coverage.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}

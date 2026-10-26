import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRightIcon, CheckCircleIcon, FileTextIcon, XCircleIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { CompanySelect } from "@/components/company-select";
import { DateField } from "@/components/date-field";
import { NoCompanyPage } from "@/components/no-company-page";
import { PageHeader } from "@/components/page-header";
import { PageState } from "@/components/page-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useActiveCompany } from "@/hooks/use-active-company";
import { apiForm, apiSend } from "@/lib/api-client";
import type { VaultDoc } from "@/lib/api-client";
import {
  classifyExpiry,
  DOC_TYPE_LABEL,
  DOC_TYPES,
  NEEDS_EXPIRY_TYPES,
  isBbbeeMismatch,
  isBcGos,
  isExpiryMismatch,
  type DocType,
  type VaultDocMutation,
} from "@/lib/compliance";
import { downloadAuthenticatedFile } from "@/lib/download";
import { formatDate } from "@/lib/date";
import { companiesQuery, councilsQuery, documentsQuery } from "@/lib/queries";

interface BbbeePreviewDto {
  extracted_bbbee_level: number | null;
  extracted_expiry_date: string | null;
}

interface BbbeePreview {
  level: number | null;
  expiry: string | null;
}

type BbbeePreviewState =
  | { status: "idle" }
  | { status: "loading"; key: string }
  | { status: "success"; key: string; value: BbbeePreview }
  | { status: "error"; key: string };

export const Route = createFileRoute("/_authed/documents")({
  component: DocumentsPage,
});

const PREVIEW_TYPES = NEEDS_EXPIRY_TYPES;

/** Shared header-cell treatment for the vault registry table (dense Swiss caps). */
const VAULT_HEAD_CLASS = "border-b px-6 py-3 label-caps text-muted-foreground";

function DocumentsPage() {
  const queryClient = useQueryClient();
  const companiesQueryResult = useQuery(companiesQuery());
  const councilsQueryResult = useQuery(councilsQuery());
  const councilCatalog = useMemo(
    () => councilsQueryResult.data?.councils ?? [],
    [councilsQueryResult.data],
  );
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [formEpoch, setFormEpoch] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    file_name: string;
    doc_type: string;
  } | null>(null);
  const [editingDoc, setEditingDoc] = useState<VaultDoc | null>(null);
  const [editForm, setEditForm] = useState<VaultDocMutation>({
    expiry_date: "",
    is_compliant: true,
    bargaining_council: null,
  });

  const [formData, setFormData] = useState<VaultDocMutation & { doc_type: string }>({
    doc_type: "",
    expiry_date: "",
    is_compliant: true,
    bargaining_council: null,
  });
  // Certificate preview keyed to the current (doc_type, file) selection so a
  // changed selection instantly hides stale responses without a reset pass.
  const [previewState, setPreviewState] = useState<BbbeePreviewState>({ status: "idle" });

  const companies = companiesQueryResult.data ?? [];
  const {
    company: selectedCompany,
    selectedId: selectedCompanyId,
    setSelectedId,
  } = useActiveCompany(companies);
  const companyId = selectedCompany?.id;

  const documentsQueryResult = useQuery({
    ...documentsQuery(companyId!),
    enabled: Boolean(companyId),
  });
  const documents = useMemo(() => documentsQueryResult.data ?? [], [documentsQueryResult.data]);

  // Per-row expiry classification, anchored once per document-list render.
  const expiryClassById = useMemo(() => {
    // oxlint-disable-next-line react/purity -- display-only freshness anchor for classifyExpiry
    const nowMs = Date.now();
    return new Map(documents.map((d) => [d.id, classifyExpiry(d.expiry_date, nowMs)]));
  }, [documents]);

  const invalidateDocuments = () =>
    queryClient.invalidateQueries({ queryKey: documentsQuery(companyId!).queryKey });

  const uploadMutation = useMutation({
    mutationFn: (form: FormData) => apiForm<VaultDoc>("/api/documents/upload", form),
    onSuccess: () => void invalidateDocuments(),
  });
  const deleteMutation = useMutation({
    mutationFn: (docId: string) => apiSend<void>("DELETE", `/api/documents/${docId}`),
    onSuccess: () => void invalidateDocuments(),
  });
  const editMutation = useMutation({
    mutationFn: ({ docId, payload }: { docId: string; payload: Record<string, unknown> }) =>
      apiSend<VaultDoc>("PATCH", `/api/documents/${docId}`, payload),
    onSuccess: () => void invalidateDocuments(),
  });

  const councilLabel = useCallback(
    (code: string) => councilCatalog.find((c) => c.code === code)?.name || code,
    [councilCatalog],
  );

  const previewKey = uploadFile
    ? `${formData.doc_type}:${uploadFile.name}:${uploadFile.size}`
    : null;
  const currentPreviewState =
    previewState.status !== "idle" && previewState.key === previewKey
      ? previewState
      : ({ status: "idle" } as const);
  const bbbeePreview = currentPreviewState.status === "success" ? currentPreviewState.value : null;
  const previewLoading =
    PREVIEW_TYPES.has(formData.doc_type as DocType) && currentPreviewState.status === "loading";

  // Preview extraction whenever a certificate file/type is picked. The result
  // is keyed to its inputs so stale responses never render — no reset pass
  // needed when the selection changes.
  useEffect(() => {
    if (!uploadFile || !previewKey || !PREVIEW_TYPES.has(formData.doc_type as DocType)) return;
    let cancelled = false;
    // oxlint-disable-next-line react/set-state-in-effect -- extraction starts when these inputs change
    setPreviewState({ status: "loading", key: previewKey });
    const fd = new FormData();
    fd.append("file", uploadFile);
    fd.append("doc_type", formData.doc_type);
    apiForm<BbbeePreviewDto>("/api/documents/preview-bbbee", fd)
      .then((d) => {
        if (cancelled) return;
        const level = d.extracted_bbbee_level;
        const expiry = d.extracted_expiry_date;
        setPreviewState({
          status: "success",
          key: previewKey,
          value: { level, expiry },
        });
      })
      .catch(() => {
        if (!cancelled) setPreviewState({ status: "error", key: previewKey });
      });
    return () => {
      cancelled = true;
    };
  }, [uploadFile, formData.doc_type, previewKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) {
      toast.error("Please create a company profile first");
      return;
    }
    if (!formData.doc_type || !uploadFile) {
      toast.error("Document type and file are required");
      return;
    }
    if (NEEDS_EXPIRY_TYPES.has(formData.doc_type as DocType) && !formData.expiry_date) {
      toast.error("Expiry date is required for this document type");
      return;
    }
    if (isBcGos(formData.doc_type) && !formData.bargaining_council) {
      toast.error("Please pick which Bargaining Council this letter is for");
      return;
    }

    try {
      const multipart = new FormData();
      multipart.append("file", uploadFile);
      multipart.append("company_id", selectedCompany.id);
      multipart.append("doc_type", formData.doc_type);
      if (formData.expiry_date) {
        multipart.append("expiry_date", formData.expiry_date);
      }
      multipart.append("is_compliant", String(formData.is_compliant));
      if (isBcGos(formData.doc_type)) {
        multipart.append("bargaining_council", formData.bargaining_council!);
      }

      const replacingExisting = documents.some((d) => {
        if (d.doc_type !== formData.doc_type) return false;
        if (isBcGos(formData.doc_type)) {
          return d.bargaining_council === formData.bargaining_council;
        }
        return true;
      });

      const uploaded = await uploadMutation.mutateAsync(multipart);

      toast.success(
        replacingExisting
          ? "Document updated — previous copy removed from vault"
          : "Document uploaded successfully!",
      );

      if (uploaded.doc_type === "BBBEE" && uploaded.extracted_bbbee_level != null) {
        const profileLevel = selectedCompany?.bbbee_level;
        if (profileLevel == null) {
          toast.info(
            `Certificate says B-BBEE Level ${uploaded.extracted_bbbee_level}. Add it to your Company Setup to earn preference points on tender analysis.`,
            { duration: 9000 },
          );
        } else if (isBbbeeMismatch(profileLevel, uploaded.extracted_bbbee_level)) {
          toast.warning(
            `Mismatch: your profile says Level ${profileLevel} but the uploaded certificate says Level ${uploaded.extracted_bbbee_level}. Update whichever is wrong before your next tender analysis.`,
            { duration: 12000 },
          );
        }
      }

      if (isExpiryMismatch(formData.expiry_date, uploaded.extracted_expiry_date)) {
        toast.warning(
          `Expiry mismatch: you typed ${formData.expiry_date}, but the document itself reads ${uploaded.extracted_expiry_date}. Update whichever is wrong so reminder emails fire at the right time.`,
          { duration: 12000 },
        );
      }

      setFormData({ doc_type: "", expiry_date: "", is_compliant: true, bargaining_council: null });
      setUploadFile(null);
      setFormEpoch((epoch) => epoch + 1);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to upload document";
      toast.error(msg);
    }
  };

  const handleDownload = async (docId: string, fileName: string) => {
    try {
      await downloadAuthenticatedFile(`/api/documents/download/${docId}`, fileName);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download document");
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteMutation.mutateAsync(pendingDelete.id);
      toast.success(`"${pendingDelete.file_name}" removed from vault`);
      setPendingDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete document");
    }
  };

  const openEdit = (doc: VaultDoc) => {
    setEditingDoc(doc);
    setEditForm({
      expiry_date: doc.expiry_date ? doc.expiry_date.slice(0, 10) : "",
      is_compliant: doc.is_compliant,
      bargaining_council: doc.bargaining_council ?? null,
    });
  };

  const handleEditSave = async () => {
    if (!editingDoc) return;
    if (NEEDS_EXPIRY_TYPES.has(editingDoc.doc_type as DocType) && !editForm.expiry_date) {
      toast.error("Expiry date is required for this document type");
      return;
    }
    if (isBcGos(editingDoc.doc_type) && !editForm.bargaining_council) {
      toast.error("Bargaining council is required");
      return;
    }
    try {
      const payload: Record<string, unknown> = {
        expiry_date: editForm.expiry_date || null,
        is_compliant: editForm.is_compliant,
      };
      if (isBcGos(editingDoc.doc_type)) {
        payload.bargaining_council = editForm.bargaining_council;
      }
      await editMutation.mutateAsync({ docId: editingDoc.id, payload });
      toast.success("Document updated");
      setEditingDoc(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update document");
    }
  };

  const vaultBaseQueries = [companiesQueryResult, councilsQueryResult];
  // A failed background refetch keeps cached data — only blank the page when
  // there is nothing cached to render.
  if (vaultBaseQueries.some((query) => query.isPending || (query.isError && !query.data))) {
    const failed = vaultBaseQueries.some((query) => query.isError && !query.data);
    return (
      <PageState
        status={failed ? "error" : "loading"}
        message="Could not load the document vault."
        errorTestId="vault-load-error"
        retryTestId="vault-retry"
        onRetry={() => void Promise.all(vaultBaseQueries.map((query) => query.refetch()))}
      />
    );
  }

  if (!companies.length) {
    return (
      <NoCompanyPage
        overline="Documents"
        title="Compliance Document Vault"
        titleTestId="vault-title"
        description="Manage and track your statutory documents with expiry alerts."
        testId="no-company-message"
      />
    );
  }

  if (
    documentsQueryResult.isPending ||
    (documentsQueryResult.isError && !documentsQueryResult.data)
  ) {
    return (
      <PageState
        status={documentsQueryResult.isError ? "error" : "loading"}
        message="Could not load your documents."
        errorTestId="vault-documents-error"
        retryTestId="vault-documents-retry"
        onRetry={() => void documentsQueryResult.refetch()}
      />
    );
  }

  return (
    <>
      <div className="flex-1 bg-background">
        <PageHeader
          overline="Documents"
          title="Compliance Document Vault"
          titleTestId="vault-title"
          description="Manage and track your statutory documents with expiry alerts."
        >
          <CompanySelect
            companies={companies}
            value={selectedCompanyId ?? ""}
            onValueChange={setSelectedId}
          />
        </PageHeader>

        <div className="p-6 sm:p-8">
          <Card className="border-border shadow-none mb-8" data-testid="add-document-card">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-xl font-bold">Add New Document</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="doc_type" className="label-caps">
                      Document Type *
                    </FieldLabel>
                    <Select
                      key={formEpoch}
                      items={DOC_TYPES.map((value) => ({
                        value,
                        label: DOC_TYPE_LABEL[value] ?? value,
                      }))}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, doc_type: value as string }))
                      }
                      value={formData.doc_type}
                    >
                      <SelectTrigger
                        id="doc_type"
                        data-testid="select-doc-type"
                        aria-label="Document Type"
                        className="mt-2 bg-card"
                      >
                        <SelectValue placeholder="Select Document Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {DOC_TYPES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {DOC_TYPE_LABEL[value] ?? value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.doc_type === "TAX_PIN" && (
                      <a
                        data-testid="link-sars-tcs-portal"
                        href="https://tools.sars.gov.za/tcc/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-foreground underline underline-offset-2 hover:text-muted-foreground"
                      >
                        Verify TCS PIN at SARS Portal
                        <ArrowUpRightIcon className="h-3 w-3" aria-hidden="true" />
                      </a>
                    )}
                    {formData.doc_type === "BBBEE" && (
                      <a
                        data-testid="link-bbbee-portal"
                        href="https://www.bbbeecommission.co.za/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-foreground underline underline-offset-2 hover:text-muted-foreground"
                      >
                        B-BBEE Commission Portal
                        <ArrowUpRightIcon className="h-3 w-3" aria-hidden="true" />
                      </a>
                    )}
                    {isBcGos(formData.doc_type) && (
                      <div className="mt-3" data-testid="bc-picker-wrapper">
                        <FieldLabel htmlFor="bc_code" className="label-caps">
                          Which Council is this Letter for? *
                        </FieldLabel>
                        <Select
                          items={councilCatalog.map((c) => ({
                            value: c.code,
                            label: `${c.code.replace(/_/g, " ")} — ${c.name}`,
                          }))}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              bargaining_council: value as string,
                            }))
                          }
                          value={formData.bargaining_council ?? ""}
                        >
                          <SelectTrigger
                            id="bc_code"
                            data-testid="select-bargaining-council"
                            aria-label="Bargaining Council"
                            className="mt-2 bg-card"
                          >
                            <SelectValue placeholder="Select Bargaining Council" />
                          </SelectTrigger>
                          <SelectContent>
                            {councilCatalog.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {`${c.code.replace(/_/g, " ")} — ${c.name}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldDescription className="text-[11px] text-muted-foreground">
                          You can upload one Letter per council — a fresh upload only replaces the
                          letter for the same council.
                        </FieldDescription>
                      </div>
                    )}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="file_name" className="label-caps">
                      Upload File *
                    </FieldLabel>
                    {/* The hidden input is not a direct child of Field: stock
                        Field widens `> .sr-only` back to auto, and the file
                        input's intrinsic ~286px then overflows the card. */}
                    <div>
                      <input
                        ref={fileInputRef}
                        id="file_name"
                        data-testid="input-file-upload"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="sr-only"
                        aria-label="Upload compliance document"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          if (file && !/\.(pdf|jpe?g|png)$/i.test(file.name)) {
                            toast.error("Only PDF, JPEG, and PNG files are accepted");
                            e.target.value = "";
                            return;
                          }
                          setUploadFile(file);
                        }}
                      />
                      <Attachment
                        state={uploadFile ? "done" : "idle"}
                        className="mt-2 w-full max-w-none"
                        data-testid={uploadFile ? "selected-upload-file" : undefined}
                      >
                        <AttachmentMedia>
                          <FileTextIcon aria-hidden="true" />
                        </AttachmentMedia>
                        <AttachmentContent>
                          <AttachmentTitle>
                            {uploadFile ? uploadFile.name : "Click to upload"}
                          </AttachmentTitle>
                          <AttachmentDescription>
                            {uploadFile
                              ? `${(uploadFile.size / 1024).toFixed(0)} KB`
                              : "PDF, JPG or PNG"}
                          </AttachmentDescription>
                        </AttachmentContent>
                        {uploadFile ? (
                          <AttachmentActions>
                            <AttachmentAction
                              aria-label={`Remove ${uploadFile.name}`}
                              data-testid="remove-upload-file"
                              onClick={() => {
                                setUploadFile(null);
                                if (fileInputRef.current) fileInputRef.current.value = "";
                              }}
                            >
                              <XCircleIcon aria-hidden="true" />
                            </AttachmentAction>
                          </AttachmentActions>
                        ) : (
                          <AttachmentTrigger
                            render={
                              <label htmlFor="file_name" aria-label="Upload compliance document">
                                <span className="sr-only">Upload compliance document</span>
                              </label>
                            }
                          />
                        )}
                      </Attachment>
                    </div>
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="expiry_date" className="label-caps">
                      {NEEDS_EXPIRY_TYPES.has(formData.doc_type as DocType)
                        ? "Expiry Date *"
                        : "Expiry Date"}
                    </FieldLabel>
                    <DateField
                      id="expiry_date"
                      testId="input-expiry-date"
                      value={formData.expiry_date}
                      onChange={(expiry_date) => setFormData((prev) => ({ ...prev, expiry_date }))}
                    />
                    {PREVIEW_TYPES.has(formData.doc_type as DocType) && previewLoading && (
                      <p
                        className="mt-1.5 text-[11px] text-muted-foreground"
                        data-testid="bbbee-preview-loading"
                      >
                        Reading certificate…
                      </p>
                    )}
                    {PREVIEW_TYPES.has(formData.doc_type as DocType) &&
                      currentPreviewState.status === "success" &&
                      !bbbeePreview?.level &&
                      !bbbeePreview?.expiry && (
                        <p
                          className="mt-1.5 text-[11px] text-muted-foreground"
                          data-testid="bbbee-preview-empty"
                        >
                          No expiry date could be detected. Enter it manually and verify it against
                          the document.
                        </p>
                      )}
                    {PREVIEW_TYPES.has(formData.doc_type as DocType) &&
                      currentPreviewState.status === "error" && (
                        <p
                          className="mt-1.5 text-[11px] text-destructive"
                          data-testid="bbbee-preview-error"
                        >
                          Could not read this document automatically. Enter the expiry date manually
                          and verify it against the document.
                        </p>
                      )}
                    {PREVIEW_TYPES.has(formData.doc_type as DocType) &&
                      bbbeePreview?.expiry &&
                      !previewLoading && (
                        <Alert
                          data-testid="bbbee-preview-hint"
                          className="mt-2 border-primary/30 bg-primary/5"
                        >
                          <AlertTitle className="text-[11px] font-semibold text-primary">
                            Detected expiry on document:
                          </AlertTitle>
                          <AlertDescription className="flex flex-wrap items-center gap-2">
                            <span
                              className="font-mono text-xs text-primary"
                              data-testid="bbbee-preview-expiry"
                            >
                              {formatDate(bbbeePreview.expiry)}
                            </span>
                            {formData.expiry_date !== bbbeePreview.expiry ? (
                              <Button
                                type="button"
                                size="xs"
                                data-testid="bbbee-preview-autofill"
                                onClick={() =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    expiry_date: bbbeePreview.expiry!,
                                  }))
                                }
                                className="ml-auto tight-caps"
                              >
                                Use this date
                              </Button>
                            ) : (
                              <span
                                className="ml-auto text-[11px] font-semibold text-primary"
                                data-testid="bbbee-preview-applied"
                              >
                                ✓ Matched
                              </span>
                            )}
                          </AlertDescription>
                        </Alert>
                      )}
                    {formData.doc_type === "BBBEE" && bbbeePreview?.level && !previewLoading && (
                      <p
                        className="mt-1.5 text-[11px] text-muted-foreground"
                        data-testid="bbbee-preview-level"
                      >
                        Also detected on cert: <strong>B-BBEE Level {bbbeePreview.level}</strong>
                        {isBbbeeMismatch(selectedCompany?.bbbee_level, bbbeePreview.level) && (
                          <span className="text-status-warning">
                            {" "}
                            — doesn&apos;t match your profile (Level {selectedCompany?.bbbee_level})
                          </span>
                        )}
                      </p>
                    )}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="is_compliant" className="label-caps">
                      Compliance Status
                    </FieldLabel>
                    <Select
                      items={[
                        { value: "true", label: "Compliant" },
                        { value: "false", label: "Non-Compliant" },
                      ]}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          is_compliant: (value as string) === "true",
                        }))
                      }
                      value={formData.is_compliant.toString()}
                    >
                      <SelectTrigger
                        id="is_compliant"
                        data-testid="select-compliance-status"
                        aria-label="Compliance Status"
                        className="mt-2 bg-card"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Compliant</SelectItem>
                        <SelectItem value="false">Non-Compliant</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <Button
                  data-testid="add-document-btn"
                  type="submit"
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? <Spinner /> : null}
                  {uploadMutation.isPending ? "Adding…" : "Add Document"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card
            className="overflow-hidden border-border shadow-none"
            data-testid="documents-list-card"
          >
            <CardHeader className="border-b border-border">
              <CardTitle className="text-xl font-bold">Document Registry</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {documents.length === 0 ? (
                <div className="p-8" data-testid="empty-docs">
                  <Empty className="gap-3 border-solid">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <FileTextIcon aria-hidden="true" />
                      </EmptyMedia>
                      <EmptyTitle>No documents uploaded yet</EmptyTitle>
                      <EmptyDescription>Add your first compliance document above.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </div>
              ) : (
                <Table className="min-w-[720px] w-full">
                  <TableHeader className="bg-card">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className={VAULT_HEAD_CLASS}>Type</TableHead>
                      <TableHead className={VAULT_HEAD_CLASS}>File Name</TableHead>
                      <TableHead className={VAULT_HEAD_CLASS}>Expiry Date</TableHead>
                      <TableHead className={VAULT_HEAD_CLASS}>Status</TableHead>
                      <TableHead className={VAULT_HEAD_CLASS}>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border">
                    {documents.map((doc) => {
                      const cls = expiryClassById.get(doc.id) ?? "none";
                      const isExpiringSoon = cls === "expiring_soon";
                      const isExpired = cls === "expired";

                      return (
                        <TableRow
                          key={doc.id}
                          className="odd:bg-card even:bg-muted hover:bg-accent"
                          data-testid={`doc-row-${doc.id}`}
                        >
                          <TableCell className="px-6 py-4 text-sm font-medium whitespace-normal">
                            {DOC_TYPE_LABEL[doc.doc_type] ?? doc.doc_type.replace(/_/g, " ")}
                            {isBcGos(doc.doc_type) && doc.bargaining_council && (
                              <Badge
                                variant="secondary"
                                data-testid={`doc-council-${doc.id}`}
                                className="ml-2 tight-caps"
                                title={councilLabel(doc.bargaining_council)}
                              >
                                {doc.bargaining_council.replace(/_/g, " ")}
                              </Badge>
                            )}
                            {doc.doc_type === "BBBEE" && doc.extracted_bbbee_level != null && (
                              <Badge
                                variant={
                                  isBbbeeMismatch(
                                    selectedCompany?.bbbee_level,
                                    doc.extracted_bbbee_level,
                                  )
                                    ? "secondary"
                                    : "outline"
                                }
                                data-testid={`doc-bbbee-cert-level-${doc.id}`}
                                className={`ml-2 rounded-sm uppercase ${
                                  isBbbeeMismatch(
                                    selectedCompany?.bbbee_level,
                                    doc.extracted_bbbee_level,
                                  )
                                    ? "bg-status-warning/10 text-status-warning"
                                    : ""
                                }`}
                              >
                                {isBbbeeMismatch(
                                  selectedCompany?.bbbee_level,
                                  doc.extracted_bbbee_level,
                                )
                                  ? `Cert L${doc.extracted_bbbee_level} ≠ Profile L${selectedCompany?.bbbee_level}`
                                  : `Cert L${doc.extracted_bbbee_level}`}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell
                            className="px-6 py-4 text-sm whitespace-normal break-all"
                            data-testid={`doc-file-${doc.id}`}
                          >
                            {doc.file_name}
                          </TableCell>
                          <TableCell className="px-6 py-4 text-sm whitespace-normal">
                            <div className="flex items-center gap-2">
                              <span
                                className={
                                  isExpired
                                    ? "text-destructive font-semibold"
                                    : isExpiringSoon
                                      ? "text-status-warning font-semibold"
                                      : ""
                                }
                              >
                                {doc.expiry_date ? formatDate(doc.expiry_date) : "—"}
                              </span>
                            </div>
                            {NEEDS_EXPIRY_TYPES.has(doc.doc_type as DocType) &&
                              isExpiryMismatch(doc.expiry_date, doc.extracted_expiry_date) && (
                                <Badge
                                  variant="secondary"
                                  data-testid={`doc-expiry-mismatch-${doc.id}`}
                                  className="mt-1 bg-status-warning/10 tight-caps text-status-warning"
                                  title={`Document reads ${doc.extracted_expiry_date}`}
                                >
                                  Cert: {formatDate(doc.extracted_expiry_date!)}
                                </Badge>
                              )}
                          </TableCell>
                          <TableCell className="px-6 py-4">
                            {doc.is_compliant && !isExpired ? (
                              <Badge
                                variant="secondary"
                                className="bg-status-success/10 text-status-success"
                                data-testid={`doc-status-compliant-${doc.id}`}
                              >
                                <CheckCircleIcon aria-hidden="true" />
                                Compliant
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="bg-destructive/10 text-destructive"
                                data-testid={`doc-status-noncompliant-${doc.id}`}
                              >
                                <XCircleIcon aria-hidden="true" />
                                {isExpired ? "Expired" : "Non-Compliant"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="px-6 py-4">
                            <div className="flex flex-wrap items-center gap-1">
                              {doc.storage_key && (
                                <Button
                                  type="button"
                                  variant="link"
                                  size="sm"
                                  data-testid={`download-doc-${doc.id}`}
                                  onClick={() => void handleDownload(doc.id, doc.file_name)}
                                >
                                  Download
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="link"
                                size="sm"
                                data-testid={`edit-doc-${doc.id}`}
                                onClick={() => openEdit(doc)}
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="link"
                                size="sm"
                                data-testid={`delete-doc-${doc.id}`}
                                onClick={() =>
                                  setPendingDelete({
                                    id: doc.id,
                                    file_name: doc.file_name,
                                    doc_type: doc.doc_type,
                                  })
                                }
                                aria-label={`Delete ${doc.file_name}`}
                                className="text-destructive"
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent data-testid="delete-doc-dialog" className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this document?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>
                {pendingDelete
                  ? (DOC_TYPE_LABEL[pendingDelete.doc_type] ??
                    pendingDelete.doc_type.replaceAll("_", " "))
                  : ""}
              </strong>{" "}
              — {pendingDelete?.file_name}
              <span className="mt-2 block">
                This deletes the file from your vault and cannot be undone. Any pending expiry
                reminders for this document will also be cleared.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-doc-cancel" disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="delete-doc-confirm"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete document"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={editingDoc != null}
        onOpenChange={(open) => {
          if (!open) setEditingDoc(null);
        }}
      >
        {editingDoc && (
          <DialogContent data-testid="edit-doc-dialog" className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Document</DialogTitle>
              <DialogDescription>
                {editingDoc
                  ? (DOC_TYPE_LABEL[editingDoc.doc_type] ?? editingDoc.doc_type.replace(/_/g, " "))
                  : ""}{" "}
                — {editingDoc?.file_name}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              <Field>
                <FieldLabel htmlFor="edit_expiry_date" className="label-caps">
                  {NEEDS_EXPIRY_TYPES.has(editingDoc.doc_type as DocType)
                    ? "Expiry Date *"
                    : "Expiry Date"}
                </FieldLabel>
                <DateField
                  id="edit_expiry_date"
                  testId="edit-expiry-date"
                  value={editForm.expiry_date}
                  onChange={(expiry_date) => setEditForm((p) => ({ ...p, expiry_date }))}
                />
                {isExpiryMismatch(editForm.expiry_date, editingDoc.extracted_expiry_date) && (
                  <p
                    className="mt-1.5 text-[11px] text-status-warning"
                    data-testid="edit-expiry-mismatch"
                  >
                    Note: certificate reads {formatDate(editingDoc.extracted_expiry_date!)}
                  </p>
                )}
              </Field>
              <Field>
                <FieldLabel className="label-caps">Compliance Status</FieldLabel>
                <Select
                  items={[
                    { value: "true", label: "Compliant" },
                    { value: "false", label: "Non-Compliant" },
                  ]}
                  value={editForm.is_compliant ? "true" : "false"}
                  onValueChange={(v) =>
                    setEditForm((p) => ({ ...p, is_compliant: (v as string) === "true" }))
                  }
                >
                  <SelectTrigger
                    data-testid="edit-compliance-status"
                    aria-label="Edit Compliance Status"
                    className="mt-2"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Compliant</SelectItem>
                    <SelectItem value="false">Non-Compliant</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {editingDoc.doc_type === "BARGAINING_COUNCIL_GOS" && (
                <Field data-testid="edit-bc-wrapper">
                  <FieldLabel className="label-caps">Bargaining Council</FieldLabel>
                  <Select
                    items={councilCatalog.map((c) => ({
                      value: c.code,
                      label: `${c.code.replace(/_/g, " ")} — ${c.name}`,
                    }))}
                    value={editForm.bargaining_council ?? ""}
                    onValueChange={(v) =>
                      setEditForm((p) => ({ ...p, bargaining_council: v as string }))
                    }
                  >
                    <SelectTrigger
                      data-testid="edit-bargaining-council"
                      aria-label="Edit Bargaining Council"
                      className="mt-2"
                    >
                      <SelectValue placeholder="Select council" />
                    </SelectTrigger>
                    <SelectContent>
                      {councilCatalog.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {`${c.code.replace(/_/g, " ")} — ${c.name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button
                data-testid="edit-doc-cancel"
                variant="outline"
                disabled={editMutation.isPending}
                onClick={() => setEditingDoc(null)}
              >
                Cancel
              </Button>
              <Button
                data-testid="edit-doc-save"
                disabled={editMutation.isPending}
                onClick={() => void handleEditSave()}
              >
                {editMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

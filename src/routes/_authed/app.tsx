import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BanknoteIcon, Building2Icon, FileDownIcon, FileTextIcon, UploadIcon } from "lucide-react";
import { useState } from "react";

import { ComplianceBanner } from "@/components/compliance-banner";
import { NoCompanyPage } from "@/components/no-company-page";
import { PageHeader } from "@/components/page-header";
import { RecentActivityPanel } from "@/components/recent-activity-panel";
import { Badge } from "@/components/ui/badge";
import { ButtonGroup } from "@/components/ui/button-group";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageState } from "@/components/page-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useActiveCompany } from "@/hooks/use-active-company";
import { downloadSbdForm, SBD_FORM_LABEL, type SbdForm } from "@/lib/download";
import { formatDate } from "@/lib/date";
import { maxBbbeePoints } from "@/lib/bbbee";
import { creditsQuery, companiesQuery, documentsQuery, tendersQuery } from "@/lib/queries";
import { VERDICT_META, verdictFromScore } from "@/lib/tender-scoring";

export const Route = createFileRoute("/_authed/app")({
  component: AppPage,
});

function SbdDownloadButton({ tenderId, form }: { tenderId: string; form: SbdForm }) {
  const label = SBD_FORM_LABEL[form];
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    setBusy(true);
    try {
      await downloadSbdForm(tenderId, form);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      data-testid={form === "sbd4" ? `sbd4-btn-${tenderId}` : `sbd61-btn-${tenderId}`}
      onClick={() => void handle()}
      disabled={busy}
      className="h-auto px-0 py-1 text-xs font-semibold underline-offset-2"
    >
      {busy ? <Spinner className="size-3" /> : <FileDownIcon aria-hidden="true" />}
      {label}
    </Button>
  );
}

function StatCard({
  testId,
  label,
  value,
  valueTestId,
  hint,
}: {
  testId: string;
  label: string;
  value: string;
  valueTestId?: string;
  hint?: string;
}) {
  return (
    <Card className="grid-border-item border-border shadow-none" data-testid={testId}>
      <CardHeader className="pb-2">
        <CardTitle className="overline-label text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="text-3xl font-bold tracking-tight text-foreground"
          data-testid={valueTestId}
        >
          {value}
        </div>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function AppPage() {
  const companiesQueryResult = useQuery(companiesQuery());
  const companies = companiesQueryResult.data ?? [];
  const { company: selectedCompany } = useActiveCompany(companies);

  const companyId = selectedCompany?.id;
  const tendersQueryResult = useQuery({ ...tendersQuery(companyId!), enabled: Boolean(companyId) });
  const documentsQueryResult = useQuery({
    ...documentsQuery(companyId!),
    enabled: Boolean(companyId),
  });
  const creditsQueryResult = useQuery({
    ...creditsQuery(companyId!),
    enabled: Boolean(companyId),
  });

  const tenders = tendersQueryResult.data ?? [];
  const documents = documentsQueryResult.data ?? [];

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
        errorTestId="dashboard-companies-error"
        retryTestId="dashboard-companies-retry"
        onRetry={() => void companiesQueryResult.refetch()}
      />
    );
  }

  if (companies.length === 0) {
    return (
      <NoCompanyPage
        overline="Dashboard"
        title="Dashboard"
        titleTestId="dashboard-title"
        description="Your compliance overview."
        testId="no-company-state"
      />
    );
  }

  const dashboardQueries = [tendersQueryResult, documentsQueryResult, creditsQueryResult];
  if (dashboardQueries.some((query) => query.isPending || (query.isError && !query.data))) {
    const failed = dashboardQueries.some((query) => query.isError && !query.data);
    return (
      <PageState
        status={failed ? "error" : "loading"}
        message="Could not load your dashboard data."
        errorTestId="dashboard-load-error"
        retryTestId="dashboard-retry"
        onRetry={() => void Promise.all(dashboardQueries.map((query) => query.refetch()))}
      />
    );
  }

  const company = selectedCompany!;
  const compliantDocs = documents.filter((d) => d.is_compliant).length;
  const totalDocs = documents.length;
  const avgFitScore =
    tenders.length > 0
      ? Math.round(tenders.reduce((sum, t) => sum + t.fit_score, 0) / tenders.length)
      : null;
  const credits = creditsQueryResult.data?.credits;

  return (
    <div className="flex flex-1 flex-col bg-background">
      <PageHeader
        overline="Dashboard"
        title={company.company_name}
        titleTestId="dashboard-title"
        actions={
          <Button
            data-testid="analyze-tender-btn"
            render={<Link to="/analyze" />}
            size="lg"
            className="w-full shrink-0 lg:w-auto"
          >
            <UploadIcon aria-hidden="true" />
            Analyze New Tender
          </Button>
        }
      />

      <div className="p-6 sm:p-8">
        {credits != null && (
          <Alert data-testid="dashboard-credit-hint" className="mb-6">
            <AlertDescription className="flex flex-wrap items-center gap-2">
              <span className="overline-label text-muted-foreground">Credits</span>
              <span
                className="text-base font-bold text-foreground"
                data-testid="dashboard-credits-value"
              >
                {credits}
              </span>
              <span className="text-xs text-muted-foreground">available</span>
              <Link
                to="/billing"
                data-testid="dashboard-billing-link"
                className="ml-auto py-1 text-xs font-semibold text-foreground underline underline-offset-2"
              >
                Manage billing →
              </Link>
            </AlertDescription>
          </Alert>
        )}

        <ComplianceBanner documents={documents} />

        <div
          className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-6 lg:grid-cols-4"
          data-testid="dashboard-stats-grid"
        >
          <StatCard
            testId="stat-bbbee"
            label="B-BBEE Level"
            value={company.bbbee_level ? `Level ${company.bbbee_level}` : "N/A"}
            valueTestId="stat-bbbee-value"
            hint="Preference points"
          />
          <StatCard
            testId="stat-cidb"
            label="CIDB Grade"
            value={company.cidb_crs_num || "Not Set"}
            valueTestId={company.cidb_crs_num ? "cidb-display" : undefined}
            hint="Registered grades & classes"
          />
          <StatCard
            testId="stat-compliance"
            label="Compliance Status"
            value={`${compliantDocs}/${totalDocs}`}
            hint="Documents compliant"
          />
          <StatCard
            testId="stat-avg-score"
            label="Avg Fit Score"
            value={avgFitScore == null ? "—" : `${avgFitScore}%`}
            hint={`Across ${tenders.length} tender${tenders.length === 1 ? "" : "s"}`}
          />
        </div>

        <RecentActivityPanel limit={8} />

        <Card className="mb-8 border-border shadow-none" data-testid="recent-tenders-card">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-xl font-bold tracking-tight">
              Recent Tender Analyses
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {tenders.length === 0 ? (
              <div className="p-8" data-testid="empty-tenders">
                <Empty className="gap-3 border-solid">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileTextIcon aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>No tenders analyzed yet</EmptyTitle>
                    <EmptyDescription>Upload a tender PDF to get started.</EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button
                      data-testid="empty-cta-analyze"
                      render={<Link to="/analyze" />}
                      variant="outline"
                    >
                      Analyze a tender
                    </Button>
                  </EmptyContent>
                </Empty>
              </div>
            ) : (
              <div className="divide-y divide-border" data-testid="recent-tenders-list">
                {tenders.slice(0, 5).map((tender) => {
                  const verdict = verdictFromScore(tender.fit_score);
                  const flagLabel =
                    tender.risk_flags.length === 1 ? "1 flag" : `${tender.risk_flags.length} flags`;
                  return (
                    <div
                      key={tender.id}
                      className="flex flex-col gap-3 px-4 py-4 sm:px-6"
                      data-testid={`tender-row-${tender.id}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <Button
                            variant="link"
                            size="xs"
                            title={tender.title}
                            data-testid={`open-tender-${tender.id}`}
                            className="h-auto w-full justify-start px-0 text-left font-medium whitespace-normal break-words text-foreground"
                            render={<Link to="/analyze" search={{ tender: tender.id }} />}
                          >
                            {tender.title}
                          </Button>
                        </div>
                        <Badge
                          className={`rounded-sm ${
                            (VERDICT_META[verdict] ?? VERDICT_META["NO-GO"]!).badgeClass
                          }`}
                          data-testid={`tender-fit-badge-${tender.id}`}
                        >
                          {verdict}
                          <span className="opacity-70">· {tender.fit_score}%</span>
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {tender.eligible_bbbee_points} /{" "}
                        {maxBbbeePoints(tender.preference_point_system)} B-BBEE
                        {" · "}
                        {flagLabel}
                        {" · "}
                        {formatDate(tender.created_at)}
                      </p>
                      <ButtonGroup>
                        <SbdDownloadButton tenderId={tender.id} form="sbd4" />
                        <SbdDownloadButton tenderId={tender.id} form="sbd61" />
                      </ButtonGroup>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="dashboard-quick-actions"
        >
          <Button
            data-testid="manage-documents-btn"
            render={<Link to="/documents" />}
            variant="outline"
            size="lg"
            className="h-auto min-h-20 items-start justify-start gap-3 px-6 py-4 text-left whitespace-normal"
          >
            <FileTextIcon className="size-6 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block font-bold">Manage Documents</span>
              <span className="mt-0.5 block text-xs leading-snug font-normal opacity-70">
                Upload and track compliance documents
              </span>
            </span>
          </Button>
          <Button
            data-testid="edit-profile-btn"
            render={<Link to="/setup" />}
            variant="outline"
            size="lg"
            className="h-auto min-h-20 items-start justify-start gap-3 px-6 py-4 text-left whitespace-normal"
          >
            <Building2Icon className="size-6 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block font-bold">Edit Company Profile</span>
              <span className="mt-0.5 block text-xs leading-snug font-normal opacity-70">
                Update CIPC, CIDB, and B-BBEE details
              </span>
            </span>
          </Button>
          <Button
            data-testid="manage-billing-btn"
            render={<Link to="/billing" />}
            variant="outline"
            size="lg"
            className="h-auto min-h-20 items-start justify-start gap-3 px-6 py-4 text-left whitespace-normal"
          >
            <BanknoteIcon className="size-6 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block font-bold">Billing &amp; Credits</span>
              <span className="mt-0.5 block text-xs leading-snug font-normal opacity-70">
                View credits and EFT payments
              </span>
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}

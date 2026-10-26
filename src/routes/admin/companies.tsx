import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageState } from "@/components/page-state";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet, apiSend, qk } from "@/lib/api-client";
import { formatDate } from "@/lib/date";

export const Route = createFileRoute("/admin/companies")({
  component: AdminCompaniesPage,
});

type CompanyRow = {
  id: string;
  company_name: string;
  cipc_num: string;
  owner_email: string | null;
  owner_name: string | null;
  user_id: string;
  credits: number;
  doc_count: number;
  expired_doc_count: number;
  tender_count: number;
  created_at: string;
};

type CompanyDetail = {
  company: {
    id: string;
    company_name: string;
    cipc_num: string;
    user_id: string;
    bbbee_level: number | null;
    cidb_crs_num: string | null;
    created_at: string;
  };
  docs: Array<{
    id: string;
    doc_type: string;
    file_name: string;
    is_compliant: boolean;
    expiry_date: string | null;
    storage_key: string | null;
  }>;
  tenders: Array<{ id: string; title: string; fit_score: number; created_at: string }>;
  credits: number;
  reminders: Array<{ id: string; threshold: number; sent_at: string }>;
  eft: Array<{ id: string; reference: string; status: string }>;
  compliance: { total: number; expired: number; compliant: number };
};

function fetchAdminCompanies(q: string): Promise<CompanyRow[]> {
  const url = q ? `/api/admin/companies?q=${encodeURIComponent(q)}` : "/api/admin/companies";
  return apiGet<CompanyRow[]>(url);
}

function AdminCompaniesPage() {
  const queryClient = useQueryClient();
  // Debounced server-side search; the API applies it before its result cap.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<CompanyRow | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const companiesQueryResult = useQuery({
    queryKey: [...qk.adminCompanies, search],
    queryFn: () => fetchAdminCompanies(search),
  });
  const companies = companiesQueryResult.data ?? null;

  const detailQueryResult = useQuery({
    queryKey: [...qk.adminCompanies, "detail", selectedCompanyId],
    queryFn: () => apiGet<CompanyDetail>(`/api/admin/companies/${selectedCompanyId!}`),
    enabled: Boolean(selectedCompanyId),
  });
  const selectedDetail = detailQueryResult.data ?? null;
  const detailLoading = Boolean(selectedCompanyId) && detailQueryResult.isPending;
  const detailFailed =
    Boolean(selectedCompanyId) && detailQueryResult.isError && !selectedDetail && !detailLoading;

  const deleteMutation = useMutation({
    mutationFn: (companyId: string) =>
      apiSend<{ cascaded?: unknown }>("DELETE", `/api/admin/companies/${companyId}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.adminCompanies }),
  });

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      const body = await deleteMutation.mutateAsync(pendingDelete.id);
      toast.success(`Deleted "${pendingDelete.company_name}"`, {
        description: `Cascaded: ${JSON.stringify(body?.cascaded ?? {})}`,
      });
      // Close the detail panel before its query refetches a deleted company.
      if (selectedCompanyId === pendingDelete.id) setSelectedCompanyId(null);
      setPendingDelete(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleImpersonate = async (row: CompanyRow) => {
    if (!row.user_id) {
      toast.error("This company has no owner to impersonate");
      return;
    }
    setImpersonatingId(row.id);
    try {
      await apiSend("POST", `/api/admin/impersonate/${row.user_id}`);
      toast.success(`Impersonating ${row.owner_email || "user"}`);
      // Full reload so every surface rebuilds against the impersonated session cookie.
      window.location.assign("/app");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impersonation failed");
    } finally {
      setImpersonatingId(null);
    }
  };

  if (companiesQueryResult.isError && !companiesQueryResult.data) {
    return (
      <PageState
        status="error"
        message="Could not load companies."
        errorTestId="admin-companies-error"
        retryTestId="admin-companies-retry"
        onRetry={() => void companiesQueryResult.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="overline-label text-muted-foreground">Companies</p>
          <h1
            className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl"
            data-testid="admin-companies-title"
          >
            Company registry
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Read every tenant&apos;s compliance posture at a glance. Delete abandoned accounts or
            inspect documents, tenders, credits and reminders.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void companiesQueryResult.refetch()}
          disabled={companiesQueryResult.isFetching}
          data-testid="admin-refresh-btn"
          className="self-start"
        >
          Refresh
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-muted-foreground" data-testid="admin-companies-count">
          {companies ? `${companies.length} companies` : "—"}
        </span>
        <Input
          type="search"
          placeholder="Search by company, CIPC, or owner"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          data-testid="admin-companies-search"
          aria-label="Search companies"
          className="sm:w-80"
        />
      </div>

      <div className="overflow-x-auto rounded-sm border bg-card">
        <Table className="min-w-[760px] text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-6 py-3 table-caps text-muted-foreground">Company</TableHead>
              <TableHead className="px-6 py-3 table-caps text-muted-foreground">Owner</TableHead>
              <TableHead className="px-6 py-3 table-caps text-muted-foreground">Docs</TableHead>
              <TableHead className="px-6 py-3 table-caps text-muted-foreground">Tenders</TableHead>
              <TableHead className="px-6 py-3 table-caps text-muted-foreground">Credits</TableHead>
              <TableHead className="px-6 py-3 table-caps text-muted-foreground">Created</TableHead>
              <TableHead className="px-6 py-3 text-right table-caps text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companiesQueryResult.isPending && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="px-6 py-10 text-center">
                  <Spinner className="mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {companies !== null && companies.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={7}
                  className="px-6 py-10 text-center text-sm text-muted-foreground"
                  data-testid="admin-companies-empty"
                >
                  No companies yet.
                </TableCell>
              </TableRow>
            )}
            {companies &&
              companies.map((r) => (
                <TableRow key={r.id} data-testid={`admin-row-${r.id}`}>
                  <TableCell className="px-6 py-4">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setSelectedCompanyId(r.id)}
                      data-testid={`admin-company-open-${r.id}`}
                      aria-label={`Open details for ${r.company_name}`}
                      className="h-auto justify-start px-0 py-0 text-left hover:bg-transparent"
                    >
                      <span className="flex flex-col items-start">
                        <span className="font-semibold text-foreground">{r.company_name}</span>
                        <span className="text-xs text-muted-foreground">{r.cipc_num}</span>
                      </span>
                    </Button>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <p className="text-xs font-semibold text-foreground">{r.owner_email || "—"}</p>
                    {r.owner_name && (
                      <p className="text-xs text-muted-foreground">{r.owner_name}</p>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-foreground">
                    {r.doc_count}{" "}
                    {r.expired_doc_count > 0 && (
                      <Badge
                        variant="outline"
                        className="ml-1 border-destructive/20 bg-destructive/10 text-[10px] font-bold text-destructive"
                      >
                        {r.expired_doc_count} expired
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-foreground">{r.tender_count}</TableCell>
                  <TableCell className="px-6 py-4 text-foreground">{r.credits}</TableCell>
                  <TableCell className="px-6 py-4 text-xs text-muted-foreground">
                    {formatDate(r.created_at)}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid={`admin-impersonate-${r.id}`}
                        aria-label={`Impersonate ${r.company_name}`}
                        onClick={() => void handleImpersonate(r)}
                        disabled={impersonatingId === r.id || !r.user_id}
                      >
                        {impersonatingId === r.id ? "…" : "Impersonate"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid={`admin-delete-${r.id}`}
                        onClick={() => setPendingDelete(r)}
                        className="border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20"
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {detailLoading && (
        <div
          className="rounded-sm border bg-card p-6 text-sm text-muted-foreground"
          data-testid="admin-company-detail-loading"
        >
          Loading company detail…
        </div>
      )}
      {detailFailed && (
        <div
          className="flex flex-col gap-3 rounded-sm border bg-card p-6 sm:flex-row sm:items-center sm:justify-between"
          data-testid="admin-company-detail-error"
        >
          <p className="text-sm text-muted-foreground">Could not load company detail.</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="xs"
              data-testid="admin-company-detail-retry"
              disabled={detailQueryResult.isFetching}
              onClick={() => void detailQueryResult.refetch()}
            >
              Try again
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setSelectedCompanyId(null)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
      {selectedDetail && (
        <div
          className="rounded-sm border bg-card p-6"
          data-testid={`admin-company-detail-${selectedDetail.company.id}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                {selectedDetail.company.company_name}
              </h2>
              <p className="text-xs text-muted-foreground">
                {selectedDetail.company.cipc_num} · B-BBEE Level{" "}
                {selectedDetail.company.bbbee_level ?? "—"} ·{" "}
                {selectedDetail.company.cidb_crs_num ?? "—"}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setSelectedCompanyId(null)}
              data-testid="admin-company-detail-close"
            >
              Close
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-sm border bg-muted p-4" data-testid="admin-company-detail-docs">
              <p className="overline-label text-muted-foreground">Compliance documents</p>
              <p className="mt-1 text-sm text-foreground">
                {selectedDetail.compliance.total} total · {selectedDetail.compliance.compliant}{" "}
                compliant · {selectedDetail.compliance.expired} expired
              </p>
              <ul className="mt-3 space-y-1 text-xs">
                {selectedDetail.docs.slice(0, 6).map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 text-muted-foreground"
                  >
                    <span className="truncate">
                      {d.doc_type}: {d.file_name}
                    </span>
                    <Badge
                      variant={d.is_compliant ? "outline" : "destructive"}
                      className={
                        d.is_compliant
                          ? "border-status-success/25 bg-status-success/10 text-[10px] font-bold text-status-success"
                          : "text-[10px] font-bold"
                      }
                    >
                      {d.is_compliant ? "ok" : "non-compliant"}
                    </Badge>
                  </li>
                ))}
                {selectedDetail.docs.length === 0 && (
                  <li className="text-muted-foreground">No documents</li>
                )}
              </ul>
            </div>
            <div
              className="rounded-sm border bg-muted p-4"
              data-testid="admin-company-detail-tenders"
            >
              <p className="overline-label text-muted-foreground">Tenders</p>
              <p className="mt-1 text-2xl font-bold">{selectedDetail.tenders.length}</p>
              <ul className="mt-3 space-y-1 text-xs">
                {selectedDetail.tenders.map((t) => (
                  <li key={t.id} className="truncate text-muted-foreground">
                    {t.title} · <span className="text-muted-foreground">{t.fit_score}%</span>
                  </li>
                ))}
                {selectedDetail.tenders.length === 0 && (
                  <li className="text-muted-foreground">No tenders</li>
                )}
              </ul>
            </div>
            <div
              className="rounded-sm border bg-muted p-4"
              data-testid="admin-company-detail-credits"
            >
              <p className="overline-label text-muted-foreground">Credits & reminders</p>
              <p className="mt-1 text-2xl font-bold">{selectedDetail.credits}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Reminders: {selectedDetail.reminders.length} · EFT: {selectedDetail.eft.length}
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {selectedDetail.reminders.slice(0, 3).map((r) => (
                  <li key={r.id}>
                    threshold {r.threshold} · {formatDate(r.sent_at)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <AlertDialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent data-testid="admin-delete-dialog" className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete company?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This permanently deletes {pendingDelete?.company_name} ({pendingDelete?.cipc_num}),
              including its documents, tenders, credits, reminders and EFT payments. Referral reward
              audit rows are retained without the deleted company link. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="text-xs text-muted-foreground">
            <p className="font-semibold text-status-warning">Cascading deletes include:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Compliance documents and stored files</li>
              <li>Tenders and stored PDFs</li>
              <li>Credits, reminders and EFT payments</li>
            </ul>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="admin-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              disabled={deleteMutation.isPending}
              data-testid="admin-delete-confirm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete company"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

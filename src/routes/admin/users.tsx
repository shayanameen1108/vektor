import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageState } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
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
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiSend, qk } from "@/lib/api-client";
import { formatDate, formatDateTime } from "@/lib/date";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  referral_code?: string | null;
  company_count: number;
  created_at: string | null;
  updated_at?: string | null;
};

type UserDetail = {
  user: UserRow;
  companies: Array<{ id: string; company_name: string; cipc_num: string; created_at: string }>;
  compliance: {
    total: number;
    compliant: number;
    expired: number;
    docs: Array<{
      id: string;
      doc_type: string;
      file_name: string;
      expiry_date: string | null;
      is_compliant: boolean;
    }>;
  };
  tenders: {
    total: number;
    items: Array<{ id: string; title: string; fit_score: number; created_at: string }>;
  };
  credits: Array<{ company_id: string; credits: number }>;
  eft: {
    total: number;
    payments: Array<{
      id: string;
      reference: string;
      status: string;
      amount: number;
      credits: number;
      created_at: string;
    }>;
  };
  reminders: { total: number; items: Array<{ id: string; threshold: number; sent_at: string }> };
  referrals: { total: number; items: Array<{ id: string; code: string; status: string }> };
  referral_rewards: { total: number; credits_earned: number };
};

function fetchAdminUsers(q: string): Promise<UserRow[]> {
  const url = q ? `/api/admin/users?q=${encodeURIComponent(q)}` : "/api/admin/users";
  return apiGet<UserRow[]>(url);
}

function fetchUserDetail(userId: string): Promise<UserDetail> {
  return apiGet<UserDetail>(`/api/admin/users/${userId}`);
}

function AdminUsersPage() {
  const queryClient = useQueryClient();
  // Debounced server-side search; the API applies it before its result cap.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const usersQueryResult = useQuery({
    queryKey: [...qk.adminUsers, search],
    queryFn: () => fetchAdminUsers(search),
  });
  const users = usersQueryResult.data ?? null;

  // Keyed on the selection so switching users (or closing the panel) cannot
  // leave a stale detail payload on screen.
  const detailQueryResult = useQuery({
    queryKey: [...qk.adminUsers, "detail", selectedUserId],
    queryFn: () => fetchUserDetail(selectedUserId!),
    enabled: Boolean(selectedUserId),
  });
  const selectedDetail = detailQueryResult.data ?? null;
  const detailLoading = Boolean(selectedUserId) && detailQueryResult.isPending;
  const detailFailed =
    Boolean(selectedUserId) && detailQueryResult.isError && !selectedDetail && !detailLoading;

  const handleImpersonate = async (u: UserRow) => {
    if (u.role === "admin") {
      toast.error("You cannot impersonate another admin");
      return;
    }
    setImpersonatingId(u.id);
    try {
      // Single guarded path: the endpoint wraps better-auth's
      // auth.api.impersonateUser behind requireAdmin.
      await apiSend("POST", `/api/admin/impersonate/${u.id}`);
      toast.success(`Impersonating ${u.email}`);
      // Full reload so every surface picks up the impersonated session cookie.
      window.location.assign("/app");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impersonation failed");
    } finally {
      setImpersonatingId(null);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: ({
      userId,
      reason,
      confirmEmail,
    }: {
      userId: string;
      reason: string;
      confirmEmail: string;
    }) =>
      apiSend<{ cascade_counts?: unknown }>("DELETE", `/api/admin/users/${userId}`, {
        reason,
        confirm_email: confirmEmail,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.adminUsers }),
  });

  const submitDelete = async () => {
    if (!deleteTarget) return;
    if (!deleteReason.trim()) {
      toast.error("A reason is required for deletion");
      return;
    }
    if (deleteConfirmEmail.trim().toLowerCase() !== deleteTarget.email.toLowerCase()) {
      toast.error("Confirmation email doesn't match target user's email");
      return;
    }
    try {
      const body = await deleteMutation.mutateAsync({
        userId: deleteTarget.id,
        reason: deleteReason.trim(),
        confirmEmail: deleteConfirmEmail.trim(),
      });
      toast.success(`Deleted ${deleteTarget.email}`, {
        description: `Cascade: ${JSON.stringify(body?.cascade_counts ?? {})}`,
      });
      // Close the detail panel before its query refetches a deleted user.
      if (selectedUserId === deleteTarget.id) setSelectedUserId(null);
      setDeleteTarget(null);
      setDeleteReason("");
      setDeleteConfirmEmail("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (usersQueryResult.isError && !usersQueryResult.data) {
    return (
      <PageState
        status="error"
        message="Could not load users."
        errorTestId="admin-users-error"
        retryTestId="admin-users-retry"
        onRetry={() => void usersQueryResult.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="overline-label text-muted-foreground">Users</p>
          <h1
            className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl"
            data-testid="admin-users-title"
          >
            User management
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            List every tenant, inspect compliance and history, and remove abandoned accounts. Delete
            is irreversible and cascades across companies, documents, tenders, payments, referrals,
            and rewards.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void usersQueryResult.refetch()}
          disabled={usersQueryResult.isFetching}
          data-testid="admin-users-refresh"
          className="self-start"
        >
          Refresh
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-muted-foreground" data-testid="admin-users-count">
          {users ? `${users.length} users` : "—"}
        </span>
        <div className="w-full sm:w-80">
          <Input
            type="search"
            placeholder="Search by email, name, or id"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            data-testid="admin-users-search"
            aria-label="Search users"
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Filter the table by email, name, or id.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-sm border bg-card">
        <Table className="min-w-[720px] text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-6 py-3 table-caps text-muted-foreground">User</TableHead>
              <TableHead className="px-6 py-3 table-caps text-muted-foreground">Role</TableHead>
              <TableHead className="px-6 py-3 table-caps text-muted-foreground">
                Companies
              </TableHead>
              <TableHead className="px-6 py-3 table-caps text-muted-foreground">Created</TableHead>
              <TableHead className="px-6 py-3 text-right table-caps text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersQueryResult.isPending && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="px-6 py-10 text-center">
                  <Spinner className="mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {users && users.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={5}
                  className="px-6 py-10 text-center text-sm text-muted-foreground"
                  data-testid="admin-users-empty"
                >
                  No users found.
                </TableCell>
              </TableRow>
            )}
            {users &&
              users.map((u) => (
                <TableRow key={u.id} data-testid={`admin-user-row-${u.id}`}>
                  <TableCell className="px-6 py-4">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setSelectedUserId(u.id)}
                      data-testid={`admin-user-open-${u.id}`}
                      aria-label={`Open details for ${u.email}`}
                      className="h-auto justify-start px-0 py-0 text-left hover:bg-transparent"
                    >
                      <span className="flex flex-col items-start">
                        <span className="font-semibold text-foreground">{u.email}</span>
                        <span className="text-xs text-muted-foreground">
                          {u.name || "—"} · {u.id.slice(0, 8)}…
                        </span>
                      </span>
                    </Button>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Badge
                      variant="outline"
                      className={
                        u.role === "admin"
                          ? "border-primary/30 bg-primary/10 tight-caps text-primary"
                          : "bg-secondary tight-caps text-secondary-foreground"
                      }
                    >
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-foreground">{u.company_count}</TableCell>
                  <TableCell className="px-6 py-4 text-xs text-muted-foreground">
                    {u.created_at ? formatDate(u.created_at) : "—"}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid={`admin-user-impersonate-${u.id}`}
                        aria-label={`Impersonate ${u.email}`}
                        onClick={() => void handleImpersonate(u)}
                        disabled={impersonatingId === u.id || u.role === "admin"}
                      >
                        {impersonatingId === u.id ? "…" : "Impersonate"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid={`admin-user-delete-${u.id}`}
                        onClick={() => {
                          setDeleteTarget(u);
                          setDeleteReason("");
                          setDeleteConfirmEmail("");
                        }}
                        disabled={u.role === "admin"}
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
          data-testid="admin-user-detail-loading"
        >
          Loading detail…
        </div>
      )}
      {detailFailed && (
        <div
          className="flex flex-col gap-3 rounded-sm border bg-card p-6 sm:flex-row sm:items-center sm:justify-between"
          data-testid="admin-user-detail-error"
        >
          <p className="text-sm text-muted-foreground">Could not load user detail.</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="xs"
              data-testid="admin-user-detail-retry"
              disabled={detailQueryResult.isFetching}
              onClick={() => void detailQueryResult.refetch()}
            >
              Try again
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setSelectedUserId(null)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
      {selectedDetail && (
        <div
          className="rounded-sm border bg-card p-6"
          data-testid={`admin-user-detail-${selectedDetail.user.id}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                {selectedDetail.user.email}
              </h2>
              <p className="text-xs text-muted-foreground">
                {selectedDetail.user.name} · {selectedDetail.user.role} · created{" "}
                {selectedDetail.user.created_at
                  ? formatDateTime(selectedDetail.user.created_at)
                  : "—"}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setSelectedUserId(null)}
              data-testid="admin-user-detail-close"
            >
              Close
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div
              className="rounded-sm border bg-muted p-4"
              data-testid="admin-user-detail-companies"
            >
              <p className="overline-label text-muted-foreground">Companies</p>
              <p className="mt-1 text-2xl font-bold">{selectedDetail.companies.length}</p>
              <ul className="mt-3 space-y-1.5 text-xs">
                {selectedDetail.companies.map((c) => (
                  <li key={c.id} className="truncate text-muted-foreground">
                    <span className="font-semibold text-foreground">{c.company_name}</span> ·{" "}
                    {c.cipc_num}
                  </li>
                ))}
                {selectedDetail.companies.length === 0 && (
                  <li className="text-muted-foreground">No companies</li>
                )}
              </ul>
            </div>
            <div
              className="rounded-sm border bg-muted p-4"
              data-testid="admin-user-detail-compliance"
            >
              <p className="overline-label text-muted-foreground">Compliance</p>
              <p className="mt-1 text-sm text-foreground">
                {selectedDetail.compliance.total} docs · {selectedDetail.compliance.compliant}{" "}
                compliant · {selectedDetail.compliance.expired} expired
              </p>
              <ul className="mt-3 space-y-1 text-xs">
                {selectedDetail.compliance.docs.slice(0, 5).map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 text-muted-foreground"
                  >
                    <span className="truncate">{d.doc_type}</span>
                    <Badge
                      variant={d.is_compliant ? "outline" : "destructive"}
                      className={
                        d.is_compliant
                          ? "border-status-success/25 bg-status-success/10 text-[10px] font-bold text-status-success"
                          : "text-[10px] font-bold"
                      }
                    >
                      {d.is_compliant ? "compliant" : "non-compliant"}
                    </Badge>
                  </li>
                ))}
                {selectedDetail.compliance.docs.length === 0 && (
                  <li className="text-muted-foreground">No documents</li>
                )}
              </ul>
            </div>
            <div className="rounded-sm border bg-muted p-4" data-testid="admin-user-detail-tenders">
              <p className="overline-label text-muted-foreground">Tenders</p>
              <p className="mt-1 text-2xl font-bold">{selectedDetail.tenders.total}</p>
              <ul className="mt-3 space-y-1 text-xs">
                {selectedDetail.tenders.items.map((t) => (
                  <li key={t.id} className="truncate text-muted-foreground">
                    {t.title} · <span className="text-muted-foreground">{t.fit_score}%</span>
                  </li>
                ))}
                {selectedDetail.tenders.items.length === 0 && (
                  <li className="text-muted-foreground">No tenders</li>
                )}
              </ul>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-sm border bg-muted p-4" data-testid="admin-user-detail-credits">
              <p className="overline-label text-muted-foreground">Credits</p>
              <p className="mt-1 text-sm text-foreground">
                {selectedDetail.credits.reduce((s, c) => s + c.credits, 0)} total across{" "}
                {selectedDetail.credits.length} companies
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {selectedDetail.credits.map((c) => (
                  <li key={c.company_id} className="truncate">
                    {c.company_id.slice(0, 8)}… · {c.credits} credits
                  </li>
                ))}
                {selectedDetail.credits.length === 0 && (
                  <li className="text-muted-foreground">No credits</li>
                )}
              </ul>
            </div>
            <div className="rounded-sm border bg-muted p-4" data-testid="admin-user-detail-eft">
              <p className="overline-label text-muted-foreground">EFT payments</p>
              <p className="mt-1 text-2xl font-bold">{selectedDetail.eft.total}</p>
              <ul className="mt-2 space-y-1 text-xs">
                {selectedDetail.eft.payments.slice(0, 5).map((p) => (
                  <li key={p.id} className="truncate text-muted-foreground">
                    <span className="font-mono font-semibold text-foreground">{p.reference}</span> ·{" "}
                    {p.status}
                  </li>
                ))}
                {selectedDetail.eft.payments.length === 0 && (
                  <li className="text-muted-foreground">No payments</li>
                )}
              </ul>
            </div>
            <div
              className="rounded-sm border bg-muted p-4"
              data-testid="admin-user-detail-reminders"
            >
              <p className="overline-label text-muted-foreground">Reminders</p>
              <p className="mt-1 text-2xl font-bold">{selectedDetail.reminders.total}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Referrals: {selectedDetail.referrals.total} · rewards{" "}
                {selectedDetail.referral_rewards.total} (
                {selectedDetail.referral_rewards.credits_earned} credits)
              </p>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteReason("");
            setDeleteConfirmEmail("");
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          data-testid="delete-user-dialog"
          className="max-h-[90svh] overflow-y-auto p-6 sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight">Delete user?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This permanently deletes {deleteTarget?.email} and its tenant data. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="text-xs text-muted-foreground">
            <p className="font-semibold text-status-warning">
              Cascading deletes across companies, documents, tenders, payments, referrals, and
              rewards:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Companies owned by this user</li>
              <li>Compliance documents (and R2 files)</li>
              <li>Tenders (and PDFs)</li>
              <li>EFT payments and proof files</li>
              <li>Referrals and referral rewards</li>
              <li>Sent reminders</li>
            </ul>
          </div>

          <div className="mt-4 space-y-3">
            <Field>
              <FieldLabel htmlFor="delete-reason" className="label-caps text-muted-foreground">
                Reason (required, for audit)
              </FieldLabel>
              <Textarea
                id="delete-reason"
                data-testid="delete-reason"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="e.g., Abandoned test account, user requested deletion"
                rows={2}
              />
            </Field>
            <Field>
              <FieldLabel
                htmlFor="delete-confirm-email"
                className="label-caps text-muted-foreground"
              >
                Type the user’s email to confirm
              </FieldLabel>
              <Input
                id="delete-confirm-email"
                data-testid="delete-confirm-email"
                value={deleteConfirmEmail}
                onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                placeholder={deleteTarget?.email ?? ""}
              />
            </Field>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="delete-cancel"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteReason("");
                setDeleteConfirmEmail("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              data-testid="delete-submit"
              onClick={() => void submitDelete()}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

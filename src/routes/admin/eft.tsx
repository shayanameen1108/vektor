import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiBlob, apiGet, apiSend, qk, type EftPayment } from "@/lib/api-client";
import { formatDateTime } from "@/lib/date";
import { EFT_STATUS_CLASS, EFT_STATUS_LABEL, type EftStatus } from "@/lib/eft";
import { formatRand } from "@/lib/money";

export const Route = createFileRoute("/admin/eft")({
  component: AdminEftPage,
});

const NEUTRAL_BADGE_CLASS = "border-border bg-secondary text-secondary-foreground";

const FILTERS = [
  { key: "pending_review", label: "Pending review", testId: "filter-pending" },
  { key: "awaiting_proof", label: "Awaiting proof", testId: "filter-awaiting" },
  { key: "confirmed", label: "Confirmed", testId: "filter-confirmed" },
  { key: "rejected", label: "Rejected", testId: "filter-rejected" },
  { key: "all", label: "All", testId: "filter-all" },
];

async function fetchAdminEft(filter: string): Promise<{ payments: EftPayment[] }> {
  const params = filter === "all" ? "" : `?status=${encodeURIComponent(filter)}`;
  return apiGet<{ payments: EftPayment[] }>(`/api/eft/admin/all${params}`);
}

function AdminEftPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("pending_review");
  const [proofPayment, setProofPayment] = useState<EftPayment | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofContentType, setProofContentType] = useState<string | null>(null);
  const [rejectPayment, setRejectPayment] = useState<EftPayment | null>(null);
  const [confirmPayment_, setConfirmPayment_] = useState<EftPayment | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const paymentsQueryResult = useQuery({
    queryKey: qk.adminEft(filter),
    queryFn: () => fetchAdminEft(filter),
  });
  const payments = useMemo(
    () => paymentsQueryResult.data?.payments ?? [],
    [paymentsQueryResult.data],
  );

  const invalidatePayments = () =>
    void queryClient.invalidateQueries({ queryKey: ["admin", "eft"] });

  const confirmMutation = useMutation({
    mutationFn: (paymentId: string) => apiSend("POST", `/api/eft/admin/${paymentId}/confirm`),
    onSuccess: () => invalidatePayments(),
  });
  const rejectMutation = useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) =>
      apiSend("POST", `/api/eft/admin/${paymentId}/reject`, { reason }),
    onSuccess: () => invalidatePayments(),
  });

  const stats = useMemo(() => {
    const total = payments.length;
    const totalAmount = payments.reduce((s, p) => s + (p.amount || 0), 0);
    return { total, totalAmount };
  }, [payments]);

  const openProof = async (payment: EftPayment) => {
    setProofPayment(payment);
    setProofUrl(null);
    setProofContentType(null);
    try {
      const { blob, contentType } = await apiBlob(`/api/eft/admin/proof/${payment.id}`);
      setProofContentType(contentType || payment.proof_content_type || "");
      setProofUrl(URL.createObjectURL(blob));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load proof");
      setProofPayment(null);
    }
  };

  const closeProof = () => {
    if (proofUrl) URL.revokeObjectURL(proofUrl);
    setProofPayment(null);
    setProofUrl(null);
    setProofContentType(null);
  };

  const confirmPayment = async (payment: EftPayment) => {
    try {
      await confirmMutation.mutateAsync(payment.id);
      toast.success(`Payment ${payment.reference} confirmed — credits granted`);
      setConfirmPayment_(null);
      closeProof();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not confirm payment");
    }
  };

  const openReject = (payment: EftPayment) => {
    setRejectPayment(payment);
    setRejectReason("");
  };

  const submitReject = async () => {
    if (!rejectPayment) return;
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    try {
      await rejectMutation.mutateAsync({
        paymentId: rejectPayment.id,
        reason: rejectReason.trim(),
      });
      toast.success(`Payment ${rejectPayment.reference} rejected`);
      setRejectPayment(null);
      setRejectReason("");
      closeProof();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reject payment");
    }
  };

  if (paymentsQueryResult.isError && !paymentsQueryResult.data) {
    return (
      <PageState
        status="error"
        message="Could not load EFT payments."
        errorTestId="admin-eft-error"
        retryTestId="admin-eft-retry"
        onRetry={() => void paymentsQueryResult.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="overline-label text-muted-foreground">EFT Payments</p>
          <h1
            className="mt-1 flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl"
            data-testid="admin-eft-title"
          >
            EFT console
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Review incoming bank transfers. Confirm to grant credits (idempotent) and best-effort
            trigger referral rewards; reject requires a reason and allows re-upload →
            pending_review. Auditable via D1 state on manual_payments and referral_rewards.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void paymentsQueryResult.refetch()}
          disabled={paymentsQueryResult.isFetching}
          data-testid="admin-eft-refresh"
          className="self-start"
        >
          Refresh
        </Button>
      </div>

      <div
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
        data-testid="admin-eft-filters"
      >
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              type="button"
              variant={filter === f.key ? "secondary" : "outline"}
              size="sm"
              onClick={() => setFilter(f.key)}
              data-testid={`admin-eft-${f.testId}`}
              aria-pressed={filter === f.key}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground sm:ml-auto" data-testid="admin-eft-summary">
          {stats.total} record{stats.total === 1 ? "" : "s"} · {formatRand(stats.totalAmount)}
        </span>
      </div>

      <div className="overflow-x-auto rounded-sm border bg-card">
        <Table className="min-w-[860px] text-sm" data-testid="admin-eft-table">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4 py-3 table-caps text-muted-foreground">
                Reference
              </TableHead>
              <TableHead className="px-4 py-3 table-caps text-muted-foreground">User</TableHead>
              <TableHead className="px-4 py-3 table-caps text-muted-foreground">Package</TableHead>
              <TableHead className="px-4 py-3 text-right table-caps text-muted-foreground">
                Amount
              </TableHead>
              <TableHead className="px-4 py-3 table-caps text-muted-foreground">Status</TableHead>
              <TableHead className="px-4 py-3 table-caps text-muted-foreground">Created</TableHead>
              <TableHead className="px-4 py-3 text-right table-caps text-muted-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paymentsQueryResult.isPending && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="px-4 py-10 text-center">
                  <Spinner className="mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!paymentsQueryResult.isPending && payments.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                  data-testid="admin-eft-empty"
                >
                  No {filter === "all" ? "" : filter.replaceAll("_", " ")} payments
                </TableCell>
              </TableRow>
            )}
            {!paymentsQueryResult.isPending &&
              payments.map((p) => {
                return (
                  <TableRow key={p.id} data-testid={`admin-eft-row-${p.id}`}>
                    <TableCell className="px-4 py-3 font-mono text-xs font-semibold text-foreground">
                      {p.reference}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <p className="text-xs font-semibold text-foreground">{p.user_email}</p>
                      <p className="text-xs text-muted-foreground">{p.company_name || "—"}</p>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <p className="text-xs font-semibold text-foreground">{p.package_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.credits} credits · {p.billing_period}
                      </p>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-semibold text-foreground">
                      {formatRand(p.amount)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-bold ${
                          EFT_STATUS_CLASS[p.status as EftStatus] ?? NEUTRAL_BADGE_CLASS
                        }`}
                      >
                        {EFT_STATUS_LABEL[p.status as EftStatus] ?? p.status}
                      </Badge>
                      {p.status === "rejected" && p.reject_reason && (
                        <p
                          className="mt-1 max-w-[200px] truncate text-[11px] text-destructive"
                          title={p.reject_reason}
                        >
                          {p.reject_reason}
                        </p>
                      )}
                      {p.status === "confirmed" && p.credits_granted != null && (
                        <p className="mt-1 text-[11px] text-status-success">
                          +{p.credits_granted} credits
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDateTime(p.created_at)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {p.proof_path && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void openProof(p)}
                            data-testid={`admin-eft-view-proof-${p.id}`}
                          >
                            Proof
                          </Button>
                        )}
                        {p.status === "pending_review" && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => setConfirmPayment_(p)}
                              data-testid={`admin-eft-confirm-${p.id}`}
                            >
                              Confirm
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openReject(p)}
                              disabled={rejectMutation.isPending}
                              data-testid={`admin-eft-reject-${p.id}`}
                              className="border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20"
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={proofPayment != null}
        onOpenChange={(open) => {
          if (!open) closeProof();
        }}
      >
        <DialogContent
          showCloseButton={false}
          data-testid="admin-eft-proof-dialog"
          className="flex max-h-[90svh] max-w-3xl flex-col gap-0 overflow-hidden p-0"
        >
          <DialogHeader className="flex-row items-center justify-between border-b px-6 py-4">
            <div>
              <DialogTitle className="text-sm font-bold tracking-tight">
                Proof · {proofPayment?.reference}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {proofPayment?.package_name} · {proofPayment?.user_email} ·{" "}
                {proofPayment?.company_name}
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={closeProof}
              data-testid="admin-eft-proof-close"
            >
              Close
            </Button>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-background p-6">
            {!proofUrl ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Loading proof…</p>
            ) : proofContentType?.includes("pdf") ? (
              <div className="space-y-3">
                <iframe
                  src={proofUrl}
                  title="Proof PDF"
                  className="h-[60svh] w-full rounded-sm border bg-card"
                  data-testid="admin-eft-proof-pdf"
                />
                <Button
                  render={
                    <a
                      href={proofUrl}
                      download={proofPayment?.proof_filename || "proof.pdf"}
                      aria-label="Download proof"
                    />
                  }
                  size="xs"
                  data-testid="admin-eft-proof-download"
                >
                  Download
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <img
                  src={proofUrl}
                  alt="Proof"
                  className="mx-auto max-h-[60svh] rounded-sm border"
                  data-testid="admin-eft-proof-image"
                />
                <Button
                  render={
                    <a
                      href={proofUrl}
                      download={proofPayment?.proof_filename || "proof"}
                      aria-label="Download proof"
                    />
                  }
                  size="xs"
                  data-testid="admin-eft-proof-download"
                >
                  Download
                </Button>
              </div>
            )}
          </div>
          {proofPayment?.status === "pending_review" && (
            <DialogFooter className="m-0 flex-row px-6 py-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openReject(proofPayment)}
                data-testid="admin-eft-proof-reject"
                className="border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20"
              >
                Reject
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setConfirmPayment_(proofPayment)}
                data-testid="admin-eft-proof-confirm"
              >
                Confirm & grant credits
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={rejectPayment != null}
        onOpenChange={(open) => {
          if (!open) setRejectPayment(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          data-testid="admin-eft-reject-dialog"
          className="p-6 sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight">Reject payment?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Rejecting {rejectPayment?.reference} marks it rejected and lets the user upload a
              corrected proof for review.
            </DialogDescription>
          </DialogHeader>
          <Field className="mt-4">
            <FieldLabel
              htmlFor="admin-eft-reject-reason"
              className="label-caps text-muted-foreground"
            >
              Reason (required)
            </FieldLabel>
            <Textarea
              id="admin-eft-reject-reason"
              data-testid="admin-eft-reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Proof does not match amount, incomplete transfer, name mismatch"
              rows={3}
            />
          </Field>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRejectPayment(null)}
              data-testid="admin-eft-reject-cancel"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void submitReject()}
              disabled={rejectMutation.isPending}
              data-testid="admin-eft-reject-submit"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rejectMutation.isPending ? "Rejecting…" : "Reject payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmPayment_ != null}
        onOpenChange={(open) => {
          if (!open) setConfirmPayment_(null);
        }}
      >
        <AlertDialogContent data-testid="admin-eft-confirm-dialog" className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm this EFT payment?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmPayment_?.package_name} (
              <span className="font-mono">{confirmPayment_?.reference}</span>) from{" "}
              {confirmPayment_?.user_email}. This grants {confirmPayment_?.credits ?? 0} credits and
              triggers the referrer reward (best-effort). This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="admin-eft-confirm-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmPayment_) void confirmPayment(confirmPayment_);
              }}
              disabled={confirmMutation.isPending}
              data-testid="admin-eft-confirm-submit"
            >
              {confirmMutation.isPending ? "Confirming…" : "Confirm & grant credits"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

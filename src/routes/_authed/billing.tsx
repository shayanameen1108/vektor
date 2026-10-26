import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  BadgeCheckIcon,
  BanknoteIcon,
  CheckIcon,
  ClockIcon,
  StarIcon,
  XCircleIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ReferralWidget } from "@/components/referral-widget";
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
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
import { Spinner } from "@/components/ui/spinner";
import { apiForm, apiSend, qk, type EftPayment } from "@/lib/api-client";
import { PLAN_SUPPORT } from "@/lib/billing-catalog";
import { formatDateTime } from "@/lib/date";
import { formatRand } from "@/lib/money";
import {
  type PackageDto,
  bankDetailsQuery,
  companiesQuery,
  creditsQuery,
  myEftPaymentsQuery,
  packagesQuery,
} from "@/lib/queries";
import { CompanySelect } from "@/components/company-select";
import { NoCompanyPage } from "@/components/no-company-page";
import { PageHeader } from "@/components/page-header";
import { PageState } from "@/components/page-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useActiveCompany } from "@/hooks/use-active-company";
import {
  EFT_STATUS_CLASS,
  EFT_STATUS_LABEL,
  rolloverCapForCycleCredits,
  type EftStatus,
} from "@/lib/eft";

export const Route = createFileRoute("/_authed/billing")({
  component: BillingPage,
});

function BillingPage() {
  const queryClient = useQueryClient();
  const packagesQueryResult = useQuery(packagesQuery());
  const packages = packagesQueryResult.data?.packages ?? [];
  const companiesQueryResult = useQuery(companiesQuery());
  const companies = companiesQueryResult.data ?? [];
  const { company: selectedCompany, setSelectedId: setSelectedCompanyId } =
    useActiveCompany(companies);
  const [dialogPkg, setDialogPkg] = useState<PackageDto | null>(null);
  const [dialogExisting, setDialogExisting] = useState<EftPayment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const companyId = selectedCompany?.id;

  const creditsQueryResult = useQuery({ ...creditsQuery(companyId!), enabled: Boolean(companyId) });
  const myPaymentsQueryResult = useQuery(myEftPaymentsQuery());
  const myPayments = myPaymentsQueryResult.data?.payments ?? [];

  const cancelMutation = useMutation({
    mutationFn: (paymentId: string) => apiSend<void>("DELETE", `/api/eft/request/${paymentId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: myEftPaymentsQuery().queryKey });
      void queryClient.invalidateQueries({ queryKey: qk.activityPrefix });
    },
  });

  const openEftDialog = (pkg: PackageDto) => {
    if (!selectedCompany) {
      toast.error("Please create a company profile first");
      return;
    }
    setDialogExisting(null);
    setDialogPkg(pkg);
    setDialogOpen(true);
  };

  const reuploadForPayment = (payment: EftPayment) => {
    // Reconstruct the minimal package header for the dialog from the payment.
    const pkg: PackageDto = {
      id: payment.lookup_key,
      lookup_key: payment.lookup_key,
      name: payment.package_name,
      description: "",
      persona: null,
      tagline: null,
      amount: payment.amount,
      amount_cents: Math.round(payment.amount * 100),
      currency: "zar",
      credits: payment.credits,
      type: payment.type,
      interval: payment.billing_period === "monthly" ? "month" : null,
      is_popular: false,
      billing_period: payment.billing_period,
    };
    setDialogPkg(pkg);
    setDialogExisting(payment);
    setDialogOpen(true);
  };

  const refreshBillingData = () => {
    void queryClient.invalidateQueries({ queryKey: myEftPaymentsQuery().queryKey });
    void queryClient.invalidateQueries({ queryKey: qk.activityPrefix });
    if (companyId)
      void queryClient.invalidateQueries({ queryKey: creditsQuery(companyId).queryKey });
  };

  const closeDialog = () => {
    setDialogOpen(false);
    refreshBillingData();
  };

  const handleCancel = async (payment: EftPayment) => {
    try {
      await cancelMutation.mutateAsync(payment.id);
      toast.success("Payment cancelled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to cancel");
    }
  };

  const billingBaseQueries = [packagesQueryResult, companiesQueryResult, myPaymentsQueryResult];
  // A failed background refetch keeps cached data — only blank the page when
  // there is nothing cached to render.
  if (billingBaseQueries.some((query) => query.isPending || (query.isError && !query.data))) {
    const failed = billingBaseQueries.some((query) => query.isError && !query.data);
    return (
      <PageState
        status={failed ? "error" : "loading"}
        message="Could not load billing data."
        errorTestId="billing-load-error"
        retryTestId="billing-retry"
        onRetry={() => void Promise.all(billingBaseQueries.map((query) => query.refetch()))}
      />
    );
  }

  if (!companies.length) {
    return (
      <NoCompanyPage
        overline="Billing"
        title="Billing & Credits"
        titleTestId="billing-title"
        description="Pay by EFT directly to our bank account. Credits are added within 1 business day of verification."
        testId="no-company-message"
      />
    );
  }

  if (creditsQueryResult.isPending || (creditsQueryResult.isError && !creditsQueryResult.data)) {
    return (
      <PageState
        status={creditsQueryResult.isError ? "error" : "loading"}
        message="Could not load your credit balance."
        errorTestId="billing-credits-error"
        retryTestId="billing-credits-retry"
        onRetry={() => void creditsQueryResult.refetch()}
      />
    );
  }

  const subscriptionPkgs = packages.filter((p) => p.type === "subscription");
  const paygPkgs = packages.filter((p) => p.type === "one_time");
  const currentCredits = creditsQueryResult.data?.credits ?? 0;
  const subscription = creditsQueryResult.data?.subscription ?? null;
  const subscriptionPlanName =
    subscription != null
      ? (packages.find((p) => p.lookup_key === subscription.lookup_key)?.name ??
        subscription.lookup_key)
      : null;
  return (
    <>
      <div className="flex-1 bg-background">
        <PageHeader
          overline="Billing"
          title="Billing & Credits"
          titleTestId="billing-title"
          description={
            <>
              Pay by EFT directly to our bank account. Credits are added within 1 business day of
              verification. All prices in ZAR. No card fees.
              <p className="mt-2 text-xs">
                Payments are facilitated by{" "}
                <span className="font-semibold text-foreground">EcoBuiltConnect (Pty) Ltd</span> via
                First National Bank.
              </p>
            </>
          }
        >
          <CompanySelect
            companies={companies}
            value={selectedCompany?.id ?? ""}
            onValueChange={setSelectedCompanyId}
          />
        </PageHeader>

        <div className="p-6 sm:p-8">
          <Card className="mb-8" data-testid="current-balance-card">
            <CardContent className="p-5 sm:p-8">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="overline-label text-muted-foreground mb-2">Current Balance</p>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span
                      className="text-3xl sm:text-4xl md:text-5xl font-bold"
                      data-testid="credit-count"
                    >
                      {currentCredits}
                    </span>
                    <span className="text-sm sm:text-lg text-muted-foreground">
                      tender analysis credits
                    </span>
                  </div>
                  <p
                    className="mt-2 text-xs text-muted-foreground"
                    data-testid="credit-company-hint"
                  >
                    Company: {selectedCompany?.company_name}
                  </p>
                </div>
                {subscription?.active && (
                  <Badge
                    data-testid="active-subscription-badge"
                    className="overline-label bg-secondary px-3 py-1 text-secondary-foreground"
                  >
                    <CheckIcon aria-hidden="true" />
                    Active · {subscriptionPlanName}
                  </Badge>
                )}
              </div>
              {subscription?.active && subscription.rollover_cap != null && (
                <p className="mt-4 text-xs text-muted-foreground" data-testid="rollover-cap-hint">
                  Rollover cap: {subscription.rollover_cap} credits
                  {currentCredits >= subscription.rollover_cap && (
                    <span className="ml-2 rounded-sm bg-secondary px-2 py-0.5 font-semibold text-foreground">
                      At cap — use some to accrue more
                    </span>
                  )}
                </p>
              )}
            </CardContent>
          </Card>

          <ReferralWidget />

          <div className="mb-8" data-testid="my-eft-payments-section">
            <h2 className="mb-3 text-lg font-bold flex items-center gap-2">Your EFT payments</h2>
            {myPayments.length === 0 ? (
              <Empty className="gap-3 border-solid" data-testid="my-eft-empty">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BanknoteIcon aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>No EFT payments yet</EmptyTitle>
                  <EmptyDescription>
                    Request a pack or subscription and your payments will show up here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-3">
                {myPayments.map((p) => (
                  <EftStatusRow
                    key={p.id}
                    payment={p}
                    onReupload={() => reuploadForPayment(p)}
                    onCancel={() => void handleCancel(p)}
                    cancelling={cancelMutation.isPending && cancelMutation.variables === p.id}
                  />
                ))}
              </div>
            )}
          </div>

          <Alert className="mb-8" data-testid="everything-included-banner">
            <CheckIcon aria-hidden="true" className="text-primary" />
            <AlertTitle>Every feature is included on every plan.</AlertTitle>
            <AlertDescription>
              Document vault, SBD 4 &amp; 6.1 auto-generation, risk alerts and expiry tracking work
              identically whether you subscribe or buy a credit pack. Subscribers get one extra
              perk: <strong className="text-foreground">unused credits roll over</strong>, up to 2×
              your monthly allowance.
            </AlertDescription>
          </Alert>

          <div className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight">Monthly Subscriptions</h2>
            </div>
            {subscriptionPkgs.length === 0 ? (
              <Empty className="border-solid" data-testid="subscription-empty">
                <EmptyHeader>
                  <EmptyTitle>No subscription plans</EmptyTitle>
                  <EmptyDescription>
                    Plans will appear here when the catalogue is available.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                data-testid="subscription-grid"
              >
                {subscriptionPkgs.map((pkg) => {
                  const rolloverCap = rolloverCapForCycleCredits(pkg.credits);
                  const support = PLAN_SUPPORT[pkg.lookup_key] ?? "Email support";
                  return (
                    <Card
                      key={pkg.id}
                      data-testid={`package-${pkg.id}`}
                      className={`relative rounded-sm ${pkg.is_popular ? "overflow-visible border-2 border-primary" : "border border-border"}`}
                    >
                      {pkg.is_popular && (
                        <Badge
                          render={
                            <div
                              data-testid={`popular-badge-${pkg.id}`}
                              className="overline-label absolute -top-3 left-1/2 -translate-x-1/2 bg-primary px-3 py-1 text-primary-foreground"
                            />
                          }
                        >
                          <StarIcon aria-hidden="true" />
                          Most Popular
                        </Badge>
                      )}
                      <CardHeader className="border-b border-border">
                        <p className="overline-label text-muted-foreground mb-1">Plan</p>
                        <CardTitle className="text-2xl font-bold">{pkg.name}</CardTitle>
                        <div className="flex items-baseline gap-1 mt-2">
                          <span className="text-3xl font-bold">{formatRand(pkg.amount)}</span>
                          <span className="text-sm text-muted-foreground">/ month</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 leading-snug">
                          {pkg.persona}
                        </p>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <ul className="space-y-3 mb-6">
                          <li className="flex items-start gap-2 text-sm">
                            <CheckIcon
                              aria-hidden="true"
                              className="text-status-success mt-0.5 shrink-0"
                            />
                            <span>
                              <strong>{pkg.credits}</strong> tender analyses / month
                            </span>
                          </li>
                          <li className="flex items-start gap-2 text-sm">
                            <CheckIcon
                              aria-hidden="true"
                              className="text-primary mt-0.5 shrink-0"
                            />
                            <span>{pkg.tagline ?? "Full compliance suite"}</span>
                          </li>
                          <li className="flex items-start gap-2 text-sm">
                            <CheckIcon
                              aria-hidden="true"
                              className="text-status-success mt-0.5 shrink-0"
                            />
                            <span>Full PDF audit report</span>
                          </li>
                          <li className="flex items-start gap-2 text-sm">
                            <CheckIcon
                              aria-hidden="true"
                              className="text-status-success mt-0.5 shrink-0"
                            />
                            <span>{support}</span>
                          </li>
                          <li className="flex items-start gap-2 text-sm">
                            <CheckIcon
                              aria-hidden="true"
                              className="text-primary mt-0.5 shrink-0"
                            />
                            <span>
                              <strong>Rollover</strong> — bank up to <strong>{rolloverCap}</strong>{" "}
                              unused credits
                            </span>
                          </li>
                        </ul>
                        <Button
                          data-testid={`subscribe-${pkg.id}`}
                          onClick={() => openEftDialog(pkg)}
                          className="w-full"
                        >
                          Pay by EFT
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <div data-testid="payg-section">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight">Pay-As-You-Go</h2>
            </div>
            {paygPkgs.length === 0 ? (
              <Empty className="border-solid" data-testid="payg-empty">
                <EmptyHeader>
                  <EmptyTitle>No credit packs</EmptyTitle>
                  <EmptyDescription>
                    Pay-as-you-go packs will appear here when available.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {paygPkgs.map((pkg) => (
                  <Card key={pkg.id} data-testid={`package-${pkg.id}`}>
                    <CardHeader className="border-b border-border">
                      <p className="overline-label text-muted-foreground mb-1">Credit Pack</p>
                      <CardTitle className="text-2xl font-bold">{pkg.name}</CardTitle>
                      <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-3xl font-bold">{formatRand(pkg.amount)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 leading-snug">
                        Perfect for quick one-off tender checks
                      </p>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <ul className="space-y-3 mb-6">
                        <li className="flex items-start gap-2 text-sm">
                          <CheckIcon
                            aria-hidden="true"
                            className="text-status-success mt-0.5 shrink-0"
                          />
                          <span>
                            <strong>{pkg.credits}</strong> tender analysis credit
                            {pkg.credits > 1 ? "s" : ""}
                          </span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <CheckIcon aria-hidden="true" className="text-primary mt-0.5 shrink-0" />
                          <span>Credit never expires — use whenever you bid</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <CheckIcon
                            aria-hidden="true"
                            className="text-status-success mt-0.5 shrink-0"
                          />
                          <span>Full compliance suite — vault, SBD forms, alerts</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <CheckIcon
                            aria-hidden="true"
                            className="text-status-success mt-0.5 shrink-0"
                          />
                          <span>One-time payment — no recurring billing</span>
                        </li>
                      </ul>
                      <Button
                        data-testid={`buy-${pkg.id}`}
                        onClick={() => openEftDialog(pkg)}
                        variant="outline"
                        className="w-full"
                      >
                        Pay by EFT
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <p className="mt-8 text-xs text-muted-foreground">
            All payments are by EFT to our First National Bank business account. Credits are added
            within 1 business day of verification. You&apos;ll receive a confirmation email at the
            address on your account.
          </p>
        </div>
      </div>

      {dialogPkg && (
        <EftPaymentDialog
          open={dialogOpen}
          onClose={closeDialog}
          pkg={dialogPkg}
          companyId={selectedCompany?.id ?? null}
          existingPayment={dialogExisting}
          onSubmitted={refreshBillingData}
        />
      )}
    </>
  );
}

function EftStatusRow({
  payment,
  onReupload,
  onCancel,
  cancelling,
}: {
  payment: EftPayment;
  onReupload: () => void;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const cfg: Record<
    EftStatus,
    {
      icon: React.ReactNode;
      description: string;
      action: string | null;
    }
  > = {
    awaiting_proof: {
      icon: <ClockIcon aria-hidden="true" />,
      description: "You started a payment but haven't uploaded proof yet.",
      action: "Upload proof",
    },
    pending_review: {
      icon: <ClockIcon aria-hidden="true" />,
      description:
        "We received your proof of payment. Credits will be added within 1 business day.",
      action: null,
    },
    rejected: {
      icon: <XCircleIcon aria-hidden="true" />,
      description: payment.reject_reason || "Please re-upload proof of payment.",
      action: "Re-upload proof",
    },
    confirmed: {
      icon: <BadgeCheckIcon aria-hidden="true" />,
      description: "Credits have been added.",
      action: null,
    },
  };
  const config = cfg[payment.status];
  // Typed as EftStatus, but a stale/unknown DB value must still render
  // something visible rather than a blank row.
  const effective = config ?? {
    icon: <ClockIcon aria-hidden="true" />,
    description: `Status: ${payment.status}`,
    action: null as string | null,
  };
  const statusClass =
    payment.status in EFT_STATUS_CLASS
      ? EFT_STATUS_CLASS[payment.status as EftStatus]
      : "border-border bg-muted text-muted-foreground";
  const statusLabel =
    payment.status in EFT_STATUS_LABEL
      ? EFT_STATUS_LABEL[payment.status as EftStatus]
      : payment.status;

  const canCancel = payment.status === "awaiting_proof" || payment.status === "pending_review";

  return (
    <Alert
      data-testid={`eft-status-${payment.id}`}
      className={`flex flex-col gap-3 sm:flex-row sm:items-start ${statusClass}`}
    >
      {effective.icon}
      <div className="min-w-0 flex-1">
        <AlertTitle className="flex flex-wrap items-center gap-2">
          <span data-testid={`eft-row-status-${payment.id}`}>{statusLabel}</span>
          <span
            className="font-mono text-xs font-normal opacity-80"
            data-testid={`eft-row-reference-${payment.id}`}
          >
            {payment.reference}
          </span>
          <span className="text-xs font-normal opacity-80">{formatRand(payment.amount)}</span>
        </AlertTitle>
        <AlertDescription>
          {effective.description}
          <p className="mt-2 text-xs text-muted-foreground">
            {payment.package_name} · created {formatDateTime(payment.created_at)}
          </p>
        </AlertDescription>
      </div>
      <div className="flex shrink-0 flex-row gap-2 sm:flex-col">
        {effective.action && (
          <Button
            type="button"
            onClick={onReupload}
            size="sm"
            variant="outline"
            className="bg-card"
            data-testid={`eft-reupload-${payment.id}`}
            disabled={cancelling}
          >
            {effective.action}
          </Button>
        )}
        {canCancel && (
          <Button
            type="button"
            onClick={onCancel}
            size="sm"
            variant="ghost"
            data-testid={`eft-cancel-${payment.id}`}
            disabled={cancelling}
          >
            {cancelling ? "Cancelling…" : "Cancel"}
          </Button>
        )}
      </div>
    </Alert>
  );
}

function EftPaymentDialog({
  open,
  onClose,
  pkg,
  companyId,
  existingPayment,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  pkg: PackageDto;
  companyId: string | null;
  existingPayment: EftPayment | null;
  onSubmitted: () => void;
}) {
  const [payment, setPayment] = useState<EftPayment | null>(existingPayment);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bankQuery = useQuery({ ...bankDetailsQuery(), enabled: open });
  const bankDetails = bankQuery.data ?? null;
  const bankDetailsError = bankQuery.isError;

  /* oxlint-disable react/set-state-in-effect -- syncing with an external prop transition */
  useEffect(() => {
    if (!open) {
      setPayment(null);
      setCreating(false);
      return;
    }
    setPayment(existingPayment);
  }, [open, existingPayment]);
  /* oxlint-enable react/set-state-in-effect */

  const handleClose = () => {
    onClose();
  };

  const generateReference = async () => {
    if (!pkg || !companyId) return;
    setCreating(true);
    try {
      const data = await apiSend<EftPayment>("POST", "/api/eft/request", {
        lookup_key: pkg.lookup_key,
        company_id: companyId,
      });
      setPayment(data);
      onSubmitted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start payment");
    } finally {
      setCreating(false);
    }
  };

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  };

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !payment) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const updated = await apiForm<EftPayment>(`/api/eft/upload-proof/${payment.id}`, form);
      setPayment(updated);
      toast.success("Proof uploaded — we'll verify and email you shortly");
      onSubmitted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const isSubmitted = payment?.status === "pending_review" || payment?.status === "confirmed";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className="max-w-lg max-h-[90svh] overflow-y-auto"
        data-testid="eft-payment-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            {isSubmitted ? "Proof submitted" : "Pay by EFT"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {pkg ? pkg.name : ""}
          </DialogDescription>
        </DialogHeader>

        {!creating && !payment && (
          <div className="space-y-5" data-testid="eft-confirm-step">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Confirm this package to generate a unique <span className="font-mono">VEK-</span>{" "}
              reference and FNB bank details. Nothing is recorded until you confirm.
            </p>
            <div className="rounded-sm border border-border px-4 py-3">
              <p className="label-caps text-muted-foreground">{pkg.name}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{formatRand(pkg.amount)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {pkg.credits} credit{pkg.credits === 1 ? "" : "s"} · pay by EFT
              </p>
            </div>
            <Button
              type="button"
              size="lg"
              className="w-full"
              data-testid="eft-generate-reference"
              onClick={() => void generateReference()}
            >
              Generate payment reference
            </Button>
          </div>
        )}

        {creating && (
          <div
            className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground"
            data-testid="eft-creating"
          >
            <Spinner className="h-5 w-5" />
            Preparing your reference…
          </div>
        )}

        {!creating && payment?.status === "awaiting_proof" && (
          <div className="space-y-5" data-testid="eft-instructions">
            <Alert className="border-primary/25 bg-primary/10">
              <AlertDescription className="text-xs leading-relaxed text-primary">
                <strong>3 steps:</strong> 1) EFT the exact amount to the account below using the
                reference <strong>as shown</strong>. 2) Save your proof of payment (PDF or
                screenshot). 3) Upload it here. Credits are added within 1 business day after we
                verify the deposit.
              </AlertDescription>
            </Alert>

            <div className="rounded-sm border border-border divide-y divide-border">
              <Row
                label="Reference (required)"
                value={payment.reference}
                onCopy={() => copy("Reference", payment.reference)}
                mono
                highlight
                testId="eft-reference"
              />
              <Row
                label="Amount (type this manually)"
                value={payment ? formatRand(payment.amount) : "—"}
                mono
                highlight
                testId="eft-amount"
              />
              {bankDetails && (
                <>
                  <Row label="Bank" value={bankDetails.bank_name} testId="eft-bank-name" />
                  <Row
                    label="Account holder"
                    value={bankDetails.account_holder}
                    testId="eft-account-holder"
                  />
                  <Row
                    label="Account number"
                    value={bankDetails.account_number}
                    onCopy={() => copy("Account number", bankDetails.account_number)}
                    mono
                    testId="eft-account-number"
                  />
                  <Row
                    label="Branch code"
                    value={bankDetails.branch_code}
                    onCopy={() => copy("Branch code", bankDetails.branch_code)}
                    mono
                    testId="eft-branch-code"
                  />
                  <Row
                    label="Account type"
                    value={bankDetails.account_type}
                    testId="eft-account-type"
                  />
                </>
              )}
              {!bankDetails && (
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-xs text-muted-foreground">
                  <span>
                    {bankDetailsError ? "Could not load bank details." : "Loading bank details…"}
                  </span>
                  {bankDetailsError && (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      data-testid="eft-bank-retry"
                      onClick={() => void bankQuery.refetch()}
                      disabled={bankQuery.isFetching}
                    >
                      {bankQuery.isFetching ? "Retrying…" : "Try again"}
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={onFilePicked}
                className="sr-only"
                aria-label="Proof of payment"
                data-testid="eft-proof-file-input"
              />
              <Attachment state={uploading ? "uploading" : "idle"} className="w-full max-w-none">
                <AttachmentMedia>
                  <BanknoteIcon aria-hidden="true" />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>
                    {uploading ? "Uploading proof…" : "Upload proof of payment"}
                  </AttachmentTitle>
                  <AttachmentDescription>PDF, PNG, JPG or WEBP · max 10MB</AttachmentDescription>
                </AttachmentContent>
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  size="sm"
                  data-testid="eft-upload-proof-btn"
                >
                  Choose file
                </Button>
              </Attachment>
            </div>
          </div>
        )}

        {isSubmitted && payment && (
          <div className="space-y-4" data-testid="eft-submitted">
            <Alert className="border-primary/25 bg-primary/10 text-center">
              <CheckIcon aria-hidden="true" className="mx-auto h-8 w-8 text-primary" />
              <AlertTitle className="text-base">Proof received</AlertTitle>
              <AlertDescription>
                We&apos;ll verify your payment and email you at{" "}
                <span className="font-mono text-xs">{payment.user_email}</span> when credits are
                added — usually within 1 business day.
                <p className="mt-4 text-xs">
                  Reference: <span className="font-mono text-foreground">{payment.reference}</span>
                </p>
                <p className="mt-1 text-xs" data-testid="eft-submitted-status">
                  Status: {EFT_STATUS_LABEL[payment.status]}
                </p>
              </AlertDescription>
            </Alert>
            <Button
              onClick={handleClose}
              size="lg"
              variant="outline"
              className="w-full"
              data-testid="eft-close-btn"
            >
              Done
            </Button>
          </div>
        )}

        {!creating && payment?.status === "rejected" && (
          <div className="space-y-4" data-testid="eft-rejected">
            <Alert variant="destructive">
              <AlertTitle>Payment rejected</AlertTitle>
              <AlertDescription>{payment.reject_reason}</AlertDescription>
            </Alert>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={onFilePicked}
              className="sr-only"
              aria-label="Proof of payment"
              data-testid="eft-proof-file-input"
            />
            <Attachment state={uploading ? "uploading" : "idle"} className="w-full max-w-none">
              <AttachmentMedia>
                <BanknoteIcon aria-hidden="true" />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>
                  {uploading ? "Uploading proof…" : "Re-upload proof of payment"}
                </AttachmentTitle>
                <AttachmentDescription>PDF, PNG, JPG or WEBP · max 10MB</AttachmentDescription>
              </AttachmentContent>
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                size="sm"
                data-testid="eft-upload-proof-btn"
              >
                Choose file
              </Button>
            </Attachment>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  onCopy,
  mono,
  highlight,
  testId,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  mono?: boolean;
  highlight?: boolean;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="overline-label text-muted-foreground">{label}</p>
        <p
          data-testid={testId}
          className={`mt-1 text-sm text-foreground ${mono ? "font-mono" : ""} ${highlight ? "font-bold" : ""} break-all`}
        >
          {value || "—"}
        </p>
      </div>
      {onCopy && (
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={onCopy}
          data-testid={`${testId}-copy`}
          aria-label={`Copy ${label}`}
        >
          Copy
        </Button>
      )}
    </div>
  );
}

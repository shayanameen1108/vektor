import type { eftPayments } from "@/db/schema/eft";

export type EftRow = typeof eftPayments.$inferSelect;

/** Single serializer for EFT rows — every EFT API response goes through this. */
export function toApiEftPayment(payment: EftRow) {
  return {
    id: payment.id,
    reference: payment.reference,
    user_id: payment.userId,
    user_email: payment.userEmail,
    company_id: payment.companyId,
    company_name: payment.companyName,
    lookup_key: payment.lookupKey,
    package_name: payment.packageName,
    amount_cents: payment.amount,
    amount: payment.amount / 100,
    credits: payment.credits,
    billing_period: payment.billingPeriod,
    type: payment.type,
    status: payment.status,
    proof_path: payment.proofPath,
    proof_content_type: payment.proofContentType,
    proof_filename: payment.proofFilename,
    reject_reason: payment.rejectReason,
    created_at: new Date(payment.createdAt).toISOString(),
    updated_at: new Date(payment.updatedAt).toISOString(),
    confirmed_at: payment.confirmedAt ? new Date(payment.confirmedAt).toISOString() : null,
    rejected_at: payment.rejectedAt ? new Date(payment.rejectedAt).toISOString() : null,
    credits_granted: payment.creditsGranted,
    confirmed_by: payment.confirmedBy ?? null,
    rejected_by: payment.rejectedBy ?? null,
  };
}

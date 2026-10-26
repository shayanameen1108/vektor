/**
 * EFT domain helpers — reference generation, status labels, bank details.
 * The status machine itself is enforced atomically in the /api/eft handlers
 * (conditional SQL updates are the single guard). Ported from backend/eft_service.py
 */

export type EftStatus = "awaiting_proof" | "pending_review" | "confirmed" | "rejected";

/** Canonical status labels — one map for every UI surface (dashboard, billing, admin). */
export const EFT_STATUS_LABEL: Record<EftStatus, string> = {
  awaiting_proof: "Awaiting proof",
  pending_review: "Pending review",
  confirmed: "Confirmed",
  rejected: "Rejected",
};

/** Shared badge/alert tints for every EFT status surface. */
export const EFT_STATUS_CLASS: Record<EftStatus, string> = {
  awaiting_proof: "border-status-warning/25 bg-status-warning/10 text-status-warning",
  pending_review: "border-primary/25 bg-primary/10 text-primary",
  confirmed: "border-status-success/25 bg-status-success/10 text-status-success",
  rejected: "border-destructive/25 bg-destructive/10 text-destructive",
};

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReference(): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * REF_ALPHABET.length);
    suffix += REF_ALPHABET[idx]!;
  }
  return `VEK-${suffix}`;
}

export interface BankDetails {
  bank_name: string;
  account_holder: string;
  account_number: string;
  branch_code: string;
  account_type: string;
}

/**
 * Read bank details from env. Only account_type defaults ("Cheque"), matching
 * backend/eft_service.py — the real account fields come from EFT_* secrets and
 * are intentionally blank when unset so a misconfigured deploy is visible.
 */
export function getBankDetails(env: {
  EFT_BANK_NAME?: string;
  EFT_ACCOUNT_HOLDER?: string;
  EFT_ACCOUNT_NUMBER?: string;
  EFT_BRANCH_CODE?: string;
  EFT_ACCOUNT_TYPE?: string;
}): BankDetails {
  const strip = (v: string | undefined) => (v ?? "").trim().replace(/^"+|"+$/g, "");
  return {
    bank_name: strip(env.EFT_BANK_NAME),
    account_holder: strip(env.EFT_ACCOUNT_HOLDER),
    account_number: strip(env.EFT_ACCOUNT_NUMBER),
    branch_code: strip(env.EFT_BRANCH_CODE),
    account_type: strip(env.EFT_ACCOUNT_TYPE) || "Cheque",
  };
}

export const ALLOWED_PROOF_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
};

export const MAX_PROOF_BYTES = 10 * 1024 * 1024;

/**
 * Rollover rule for subscriptions: unused credits bank up to 2× the monthly
 * allowance (annual plans are not in the catalog). Single source used by the
 * EFT confirm handler and the Billing page hint.
 */
export function rolloverCapForCycleCredits(cycleCredits: number): number {
  return cycleCredits * 2;
}

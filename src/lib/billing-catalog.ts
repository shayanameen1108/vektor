/**
 * Canonical billing catalog — ZAR, EFT only, no Stripe.
 * Mirrors VEKTOR/backend/billing_service.py CATALOG (4 entries) and
 * backend/eft_service.py usage. Single source of truth for prices.
 */

export interface CatalogEntry {
  name: string;
  description: string;
  persona: string;
  tagline: string;
  amount_cents: number;
  credits: number;
  lookup_key: string;
  interval: "month" | null;
  type: "subscription" | "one_time";
  is_popular: boolean;
  billing_period: "monthly" | "one_time";
}

export const CATALOG: CatalogEntry[] = [
  {
    name: "Starter",
    description: "5 tender analyses per month",
    persona: "Freelancers & occasional tender bidders",
    tagline: "Standard compliance check",
    amount_cents: 39900,
    credits: 5,
    lookup_key: "tc_starter_monthly_v2",
    interval: "month",
    type: "subscription",
    is_popular: false,
    billing_period: "monthly",
  },
  {
    name: "Pro",
    description: "20 tender analyses per month",
    persona: "Growing businesses bidding monthly",
    tagline: "Priority compliance check",
    amount_cents: 129900,
    credits: 20,
    lookup_key: "tc_pro_monthly_v2",
    interval: "month",
    type: "subscription",
    is_popular: true,
    billing_period: "monthly",
  },
  {
    name: "Scale",
    description: "50 tender analyses per month",
    persona: "Active contractors & high-volume vendors",
    tagline: "Fast-track processing",
    amount_cents: 249900,
    credits: 50,
    lookup_key: "tc_scale_monthly_v2",
    interval: "month",
    type: "subscription",
    is_popular: false,
    billing_period: "monthly",
  },
  {
    name: "Single Analysis",
    description: "1 tender analysis credit — perfect for quick one-off tender checks",
    persona: "One-off tender check",
    tagline: "Pay-as-you-go",
    amount_cents: 14900,
    credits: 1,
    lookup_key: "tc_credits_1_v2",
    interval: null,
    type: "one_time",
    is_popular: false,
    billing_period: "one_time",
  },
];

export function entryByLookup(lookupKey: string): CatalogEntry | undefined {
  return CATALOG.find((e) => e.lookup_key === lookupKey);
}

/** Support line shown on the landing and billing plan cards. */
export const PLAN_SUPPORT: Record<string, string> = {
  tc_starter_monthly_v2: "Email support",
  tc_pro_monthly_v2: "Priority support",
  tc_scale_monthly_v2: "Dedicated support",
};

export function toPackageApi(entry: CatalogEntry) {
  return {
    id: entry.lookup_key,
    lookup_key: entry.lookup_key,
    name: entry.name,
    description: entry.description,
    persona: entry.persona,
    tagline: entry.tagline,
    amount: entry.amount_cents / 100,
    amount_cents: entry.amount_cents,
    currency: "zar" as const,
    credits: entry.credits,
    type: entry.type,
    interval: entry.interval,
    is_popular: entry.is_popular,
    billing_period: entry.billing_period,
  };
}

/**
 * Single browser-side seam for talking to the app's /api routes.
 *
 * Pages read through the queryOptions factories in queries.ts (TanStack Query)
 * and mutate via useMutation + invalidateQueries. Errors are normalized to
 * ApiError so pages can show `{ detail }` messages without ad-hoc parsing.
 */

import type { EftStatus } from "@/lib/eft";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let detail = res.statusText || "Request failed";
  try {
    const body = (await res.json()) as { detail?: string };
    if (body?.detail) detail = body.detail;
  } catch {
    // non-JSON error body — keep statusText
  }
  return new ApiError(res.status, detail);
}

/** GET JSON, throwing ApiError with the server's `detail` on failure. */
export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

/** POST/PATCH/DELETE JSON and parse the response (when present). */
export async function apiSend<T>(
  method: "POST" | "PATCH" | "DELETE",
  url: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** POST multipart FormData (file uploads). */
export async function apiForm<T>(url: string, form: FormData): Promise<T> {
  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

/** GET a binary response (e.g. uploaded proof of payment) with its content type. */
export async function apiBlob(url: string): Promise<{ blob: Blob; contentType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw await parseError(res);
  return {
    blob: await res.blob(),
    contentType: res.headers.get("content-type") ?? "",
  };
}

// ---------------------------------------------------------------------------
// Query keys — single registry so invalidation always matches.
// ---------------------------------------------------------------------------

export const qk = {
  companies: ["companies"] as const,
  documents: (companyId: string) => ["documents", companyId] as const,
  tenders: (companyId: string) => ["tenders", companyId] as const,
  tender: (tenderId: string) => ["tender", tenderId] as const,
  credits: (companyId: string) => ["credits", companyId] as const,
  activity: (type: string | null) => ["activity", type] as const,
  activityPrefix: ["activity"] as const,
  packages: ["packages"] as const,
  councils: ["councils"] as const,
  myEftPayments: ["eft", "my-requests"] as const,
  bankDetails: ["eft", "bank-details"] as const,
  myReferrals: ["referrals", "my"] as const,
  referralLookup: (code: string) => ["referrals", "lookup", code] as const,
  adminStats: ["admin", "stats"] as const,
  adminUsers: ["admin", "users"] as const,
  adminCompanies: ["admin", "companies"] as const,
  adminEft: (status: string) => ["admin", "eft", status] as const,
} as const;

// ---------------------------------------------------------------------------
// DTO types — the snake_case shapes produced by the server serializers.
// ---------------------------------------------------------------------------

export interface Company {
  id: string;
  company_name: string;
  cipc_num: string;
  csd_maaa_num: string | null;
  sars_tcs_pin: string | null;
  cidb_crs_num: string | null;
  bbbee_level: number | null;
  contact_email: string | null;
  contact_phone: string | null;
  authorised_signatory_name: string | null;
  authorised_signatory_position: string | null;
  bargaining_councils: string[];
  preferred_pppfa_system: string | null;
  alerts_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface VaultDoc {
  id: string;
  company_id: string;
  doc_type: string;
  file_name: string;
  expiry_date: string | null;
  is_compliant: boolean;
  storage_key: string | null;
  bargaining_council: string | null;
  extracted_bbbee_level: number | null;
  extracted_expiry_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReturnableState {
  verified: boolean;
  verified_at: string | null;
  doc_ref: string | null;
  file_name?: string | null;
}

export interface Tender {
  id: string;
  company_id: string;
  tender_number: string | null;
  title: string;
  issuing_entity: string | null;
  closing_date: string | null;
  required_cidb_grade: string | null;
  preference_point_system: string;
  parsed_returnables: unknown[];
  evaluation_criteria: unknown[];
  fit_score: number;
  risk_flags: unknown[];
  eligible_bbbee_points: number;
  returnable_status: Record<string, ReturnableState>;
  pdf_storage_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface EftPayment {
  id: string;
  reference: string;
  user_id: string;
  user_email: string;
  company_id: string;
  company_name: string;
  lookup_key: string;
  package_name: string;
  amount_cents: number;
  amount: number;
  credits: number;
  billing_period: string;
  type: string;
  status: EftStatus;
  proof_path: string | null;
  proof_content_type?: string | null;
  proof_filename?: string | null;
  reject_reason: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  rejected_at: string | null;
  credits_granted: number | null;
  confirmed_by?: string | null;
  rejected_by?: string | null;
}

interface TenderActivity {
  type: "tender";
  id: string;
  created_at: string;
  title: string;
  issuing_entity: string | null;
  fit_score: number;
  verdict: string;
  company_id: string;
}

interface EftActivity {
  type: "eft";
  id: string;
  created_at: string;
  reference: string;
  plan_name: string;
  amount: number;
  status: string;
  credits_granted: number | null;
  confirmed_at: string | null;
}

interface ReferralRewardActivity {
  type: "referral_reward";
  id: string;
  created_at: string;
  credits_granted: number;
  plan_lookup_key: string | null;
  trigger_reference: string | null;
}

export type ActivityItem = TenderActivity | EftActivity | ReferralRewardActivity;

export interface BargainingCouncilDto {
  code: string;
  name: string;
  scope: string;
  sectors: string[];
  cidb_classes: string[];
  regions?: string[] | null;
  website?: string | null;
}

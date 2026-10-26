/**
 * Verification service — regex-only format validators + deep-links.
 * Ported verbatim from backend/verification_service.py
 * No live API lookups.
 */

const CIPC_PATTERN = /^(?<year>\d{4})\/(?<seq>\d{6,7})\/(?<type>\d{2})$/;
const SARS_TCS_PATTERN = /^[A-Za-z0-9]{9,10}$/;
const CSD_MAAA_PATTERN = /^MAAA\d{7}$/i;

const ENTITY_TYPE_MAP: Record<string, string> = {
  "06": "Public company (Ltd)",
  "07": "Private company (Pty) Ltd",
  "08": "External / foreign company",
  "09": "Non-profit company (NPC)",
  "10": "State-owned company (SOC)",
  "11": "Personal liability company (Inc.)",
  "20": "Close corporation (CC)",
  "21": "Business trust",
  "23": "Co-operative",
  "24": "Section 21 (old form NPC)",
};

interface VerifyResult {
  valid: boolean;
  input: string;
  reason?: string;
  normalized?: string;
  incorporation_year?: number;
  entity_type_code?: string;
  entity_type_label?: string;
  verify_url: string;
  verify_url_label?: string;
  hint?: string;
}

export function verifyCipc(value: string): VerifyResult {
  const val = (value ?? "").trim();
  const m = CIPC_PATTERN.exec(val);
  if (!m || !m.groups) {
    return {
      valid: false,
      input: val,
      reason: "Format must be YYYY/NNNNNN/TT (e.g. 2021/123456/07)",
      verify_url: "https://esearch.cipc.co.za/",
    };
  }
  const year = Number(m.groups?.year);
  const entityCode = m.groups?.type ?? "";
  const currentYear = new Date().getUTCFullYear();
  const yearOk = year >= 1900 && year <= currentYear;
  if (!yearOk) {
    return {
      valid: false,
      input: val,
      reason: `Incorporation year ${year} is out of realistic range`,
      verify_url: "https://esearch.cipc.co.za/",
    };
  }
  return {
    valid: true,
    input: val,
    normalized: val,
    incorporation_year: year,
    entity_type_code: entityCode,
    entity_type_label: ENTITY_TYPE_MAP[entityCode] ?? "Unknown entity type",
    verify_url: `https://esearch.cipc.co.za/Login.aspx?ReturnUrl=%2fCompanySearch.aspx%3fCoNo%3d${encodeURIComponent(val)}`,
    verify_url_label: "Verify at CIPC eSearch",
  };
}

export function verifySarsTcs(value: string): VerifyResult {
  const val = (value ?? "").trim();
  const m = SARS_TCS_PATTERN.exec(val);
  if (!m) {
    return {
      valid: false,
      input: val,
      reason: "TCS PIN must be 9–10 alphanumeric characters",
      verify_url: "https://tools.sars.gov.za/tcc/",
    };
  }
  return {
    valid: true,
    input: val,
    normalized: val.toUpperCase(),
    verify_url: "https://tools.sars.gov.za/tcc/",
    verify_url_label: "Verify at SARS TCS Portal",
    hint: "Open the SARS TCS portal, enter your Tax Reference number + this PIN.",
  };
}

export function verifyCsdMaaa(value: string): VerifyResult {
  const val = (value ?? "").trim().toUpperCase();
  const m = CSD_MAAA_PATTERN.exec(val);
  if (!m) {
    return {
      valid: false,
      input: val,
      reason: "MAAA number must be 'MAAA' followed by 7 digits (e.g. MAAA0123456)",
      verify_url: "https://secure.csd.gov.za/",
    };
  }
  return {
    valid: true,
    input: val,
    normalized: val,
    verify_url: "https://secure.csd.gov.za/",
    verify_url_label: "Verify at CSD Portal",
    hint: "Log in to CSD, use Supplier → Search to confirm your registration status is 'Approved'.",
  };
}

const VERIFY_DISPATCH = new Map<string, (v: string) => VerifyResult>([
  ["cipc", verifyCipc],
  ["sars", verifySarsTcs],
  ["sars_tcs", verifySarsTcs],
  ["tcs", verifySarsTcs],
  ["csd", verifyCsdMaaa],
  ["csd_maaa", verifyCsdMaaa],
  ["maaa", verifyCsdMaaa],
]);

export function verify(kind: string, value: string): VerifyResult | null {
  const k = (kind ?? "").toLowerCase();
  const fn = VERIFY_DISPATCH.get(k);
  return fn ? fn(value) : null;
}

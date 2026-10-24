import { describe, expect, it } from "vite-plus/test";

import {
  companyInputSchema,
  companyPatchSchema,
  companyPatchUpdates,
  statutoryInputSchema,
} from "@/lib/company-validation";
import { documentPatchSchema } from "@/lib/document-api";

// V05: the shared input schemas are the contract behind POST/PATCH
// /api/companies, PATCH /api/documents/:id and the setup UI. These cases
// pin the previously silent coercions (String(null), Boolean("false"),
// nullIfBlank(number)) which must now refuse, and the legitimate
// string/number forms that must keep working.

const issue = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? null : (result.error?.issues[0]?.message ?? null);

describe("companyPatchSchema", () => {
  it("accepts a sparse payload and leaves absent keys absent", () => {
    const parsed = companyPatchSchema.safeParse({});
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({});
    expect(companyPatchUpdates(parsed.data!)).toEqual({});
  });

  it.each([
    ["null company_name", { company_name: null }],
    ["numeric company_name", { company_name: 123 }],
    ["numeric contact_email", { contact_email: 123 }],
    ["object contact_phone", { contact_phone: { tel: "1" } }],
    ["string false alerts_enabled", { alerts_enabled: "false" }],
    ["numeric alerts_enabled", { alerts_enabled: 1 }],
    ["boolean bbbee_level", { bbbee_level: true }],
    ["out-of-range bbbee_level", { bbbee_level: 9 }],
    ["non-integer bbbee_level", { bbbee_level: 2.5 }],
    ["non-array bargaining_councils", { bargaining_councils: "MEIBC" }],
    ["unknown bargaining council", { bargaining_councils: ["NOT_A_COUNCIL"] }],
    ["non-string council element", { bargaining_councils: [7] }],
    ["bad PPPFA value", { preferred_pppfa_system: "70/30" }],
    ["numeric preferred_pppfa_system", { preferred_pppfa_system: 8020 }],
    ["malformed cipc_num", { cipc_num: "not-a-cipc" }],
    ["null cipc_num cannot clear the statutory key", { cipc_num: null }],
    ["numeric csd_maaa_num", { csd_maaa_num: 123 }],
  ] as const)("rejects %s", (_name, input) => {
    const parsed = companyPatchSchema.safeParse(input);
    expect(parsed.success).toBe(false);
    expect(issue(parsed)).toBeTruthy();
  });

  it.each([
    ["trims company_name", { company_name: "  Acme Pty Ltd  " }, { company_name: "Acme Pty Ltd" }],
    ["blank contact_email clears", { contact_email: "  " }, { contact_email: null }],
    ["null contact_phone clears", { contact_phone: null }, { contact_phone: null }],
    ["string bbbee_level keeps its numeric form", { bbbee_level: "4" }, { bbbee_level: 4 }],
    ["numeric bbbee_level", { bbbee_level: 3 }, { bbbee_level: 3 }],
    ["null bbbee_level clears", { bbbee_level: null }, { bbbee_level: null }],
    [
      "councils dedupe and keep order",
      { bargaining_councils: ["MEIBC", "BCCEI", "MEIBC"] },
      { bargaining_councils: ["MEIBC", "BCCEI"] },
    ],
    ["null councils clears", { bargaining_councils: null }, { bargaining_councils: null }],
    [
      "pppfa 90/10 keeps its value",
      { preferred_pppfa_system: "90/10" },
      { preferred_pppfa_system: "90/10" },
    ],
    ["blank pppfa clears", { preferred_pppfa_system: "" }, { preferred_pppfa_system: null }],
    ["alerts_enabled false stays false", { alerts_enabled: false }, { alerts_enabled: false }],
    ["alerts_enabled true stays true", { alerts_enabled: true }, { alerts_enabled: true }],
    ["valid cipc normalizes", { cipc_num: "2021/123456/07" }, { cipc_num: "2021/123456/07" }],
    ["blank sars_tcs_pin clears", { sars_tcs_pin: "" }, { sars_tcs_pin: null }],
  ] as const)("accepts %s", (_name, input, expected) => {
    const parsed = companyPatchSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject(expected);
  });

  it("maps only-sent keys onto columns", () => {
    expect(
      companyPatchUpdates(
        companyPatchSchema.parse({
          contact_email: null,
          bargaining_councils: ["MEIBC"],
          alerts_enabled: false,
        }),
      ),
    ).toEqual({
      contactEmail: null,
      bargainingCouncils: '["MEIBC"]',
      alertsEnabled: false,
    });
    expect(companyPatchUpdates(companyPatchSchema.parse({}))).toEqual({});
  });
});

describe("companyInputSchema (create)", () => {
  const base = { company_name: "Acme Pty Ltd", cipc_num: "2021/123456/07" };

  it("accepts the minimal create payload", () => {
    const parsed = companyInputSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    expect(parsed.data!.alerts_enabled).toBeUndefined();
  });

  it("reports the missing name before anything else", () => {
    const parsed = companyInputSchema.safeParse({ cipc_num: "2021/123456/07" });
    expect(issue(parsed)).toBe("Company name is required");
  });

  it("reports the missing CIPC before anything else after the name", () => {
    const parsed = companyInputSchema.safeParse({ company_name: "Acme" });
    expect(issue(parsed)).toBe("CIPC number is required");
  });

  it("rejects a string boolean instead of coercing it", () => {
    const parsed = companyInputSchema.safeParse({ ...base, alerts_enabled: "false" });
    expect(parsed.success).toBe(false);
  });
});

describe("statutoryInputSchema (setup UI ready-check)", () => {
  it("is not ready until the CIPC verifies", () => {
    expect(
      statutoryInputSchema.safeParse({
        cipc_num: "",
        csd_maaa_num: "",
        sars_tcs_pin: "",
      }).success,
    ).toBe(false);
    expect(
      statutoryInputSchema.safeParse({
        cipc_num: "2021/123456/07",
        csd_maaa_num: "",
        sars_tcs_pin: "",
      }).success,
    ).toBe(true);
  });
});

describe("documentPatchSchema", () => {
  it.each([
    ["numeric expiry_date", { expiry_date: 12345 }],
    ["string false is_compliant", { is_compliant: "false" }],
    ["numeric is_compliant", { is_compliant: 0 }],
    ["numeric bargaining_council", { bargaining_council: 123 }],
    ["null is_compliant", { is_compliant: null }],
  ] as const)("rejects %s", (_name, input) => {
    const parsed = documentPatchSchema.safeParse(input);
    expect(parsed.success).toBe(false);
    expect(issue(parsed)).toBeTruthy();
  });

  it.each([
    ["null expiry_date clears", { expiry_date: null }, { expiry_date: null }],
    [
      "string expiry_date passes through",
      { expiry_date: "2026-03-15" },
      { expiry_date: "2026-03-15" },
    ],
    ["is_compliant false stays false", { is_compliant: false }, { is_compliant: false }],
    [
      "bargaining_council string passes through",
      { bargaining_council: "MEIBC" },
      { bargaining_council: "MEIBC" },
    ],
    ["null bargaining_council clears", { bargaining_council: null }, { bargaining_council: null }],
    ["empty patch", {}, {}],
  ] as const)("accepts %s", (_name, input, expected) => {
    const parsed = documentPatchSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual(expected);
  });
});

import { describe, expect, it } from "vite-plus/test";

import { companyInputSchema, companyPatchSchema } from "@/lib/company-validation";
import { verifyCipc, verifyCsdMaaa, verifySarsTcs, verify } from "@/lib/verification";

const issue = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? null : (result.error?.issues[0]?.message ?? null);

describe("verification", () => {
  describe("verifyCipc", () => {
    it("accepts valid CIPC format YYYY/NNNNNN/TT", () => {
      const r = verifyCipc("2021/123456/07");
      expect(r.valid).toBe(true);
      expect(r.incorporation_year).toBe(2021);
      expect(r.entity_type_label).toBe("Private company (Pty) Ltd");
      expect(r.verify_url).toContain("esearch.cipc.co.za");
    });

    it("accepts 7-digit sequence", () => {
      const r = verifyCipc("2019/1234567/07");
      expect(r.valid).toBe(true);
    });

    it("rejects invalid format", () => {
      const r = verifyCipc("2021-123456-07");
      expect(r.valid).toBe(false);
      expect(r.reason).toContain("YYYY/NNNNNN/TT");
    });

    it("rejects out-of-range year", () => {
      const r = verifyCipc("1899/123456/07");
      expect(r.valid).toBe(false);
      expect(r.reason).toContain("out of realistic range");
    });

    it("exposes entity type map for 06 public company", () => {
      const r = verifyCipc("2020/000001/06");
      expect(r.valid).toBe(true);
      expect(r.entity_type_label).toBe("Public company (Ltd)");
    });
  });

  describe("verifySarsTcs", () => {
    it("accepts 9-char alphanumeric", () => {
      expect(verifySarsTcs("A1B2C3D4E").valid).toBe(true);
      expect(verifySarsTcs("abc123def9").valid).toBe(true);
    });

    it("accepts 10-char alphanumeric and normalizes to upper", () => {
      const r = verifySarsTcs("ab12cd34ef");
      expect(r.valid).toBe(true);
      expect(r.normalized).toBe("AB12CD34EF");
    });

    it("rejects too short", () => {
      expect(verifySarsTcs("ABC123").valid).toBe(false);
    });

    it("rejects with special chars", () => {
      expect(verifySarsTcs("ABC-12345!").valid).toBe(false);
    });

    it("provides SARS portal link", () => {
      const r = verifySarsTcs("ABCDE12345");
      expect(r.verify_url).toContain("tools.sars.gov.za");
    });
  });

  describe("verifyCsdMaaa", () => {
    it("accepts MAAA + 7 digits", () => {
      expect(verifyCsdMaaa("MAAA0123456").valid).toBe(true);
      expect(verifyCsdMaaa("maaa0123456").valid).toBe(true);
    });

    it("rejects wrong prefix or length", () => {
      expect(verifyCsdMaaa("MAAA123").valid).toBe(false);
      expect(verifyCsdMaaa("MAAB0123456").valid).toBe(false);
      expect(verifyCsdMaaa("MAAA012345").valid).toBe(false);
    });

    it("normalizes to upper", () => {
      const r = verifyCsdMaaa("maaa0000001");
      expect(r.normalized).toBe("MAAA0000001");
    });
  });

  describe("verify dispatcher", () => {
    it("dispatches cipc", () => {
      expect(verify("cipc", "2021/123456/07")?.valid).toBe(true);
    });
    it("dispatches sars aliases", () => {
      expect(verify("sars_tcs", "ABCDE12345")?.valid).toBe(true);
      expect(verify("tcs", "ABCDE12345")?.valid).toBe(true);
    });
    it("dispatches csd aliases", () => {
      expect(verify("csd_maaa", "MAAA0123456")?.valid).toBe(true);
      expect(verify("maaa", "MAAA0123456")?.valid).toBe(true);
    });
    it("returns null for unknown kind", () => {
      expect(verify("unknown", "value")).toBeNull();
    });
  });
});

// Statutory rules now live in the shared Zod input schemas (see
// input-validation.test.ts for the full contract); the same format checks
// and normalization apply.
describe("company statutory input validation", () => {
  it("requires a valid string CIPC number on create", () => {
    expect(issue(companyInputSchema.safeParse({ company_name: "Acme" }))).toBe(
      "CIPC number is required",
    );
    expect(
      issue(companyInputSchema.safeParse({ company_name: "Acme", cipc_num: 202112345607 })),
    ).toBe("CIPC number must be a string");
    expect(
      issue(companyInputSchema.safeParse({ company_name: "Acme", cipc_num: "2021-123456-07" })),
    ).toBe("Invalid CIPC number: Format must be YYYY/NNNNNN/TT (e.g. 2021/123456/07)");
  });

  it("normalizes valid statutory values", () => {
    const parsed = companyPatchSchema.safeParse({
      cipc_num: " 2021/123456/07 ",
      csd_maaa_num: " maaa0123456 ",
      sars_tcs_pin: " ab12cd34ef ",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({
      cipc_num: "2021/123456/07",
      csd_maaa_num: "MAAA0123456",
      sars_tcs_pin: "AB12CD34EF",
    });
  });

  it("rejects invalid supplied CSD and SARS values and non-string types", () => {
    expect(issue(companyPatchSchema.safeParse({ csd_maaa_num: "MAAA123" }))).toBe(
      "Invalid CSD/MAAA number: MAAA number must be 'MAAA' followed by 7 digits (e.g. MAAA0123456)",
    );
    expect(issue(companyPatchSchema.safeParse({ sars_tcs_pin: "ABC-123" }))).toBe(
      "Invalid SARS TCS PIN: TCS PIN must be 9–10 alphanumeric characters",
    );
    expect(issue(companyPatchSchema.safeParse({ csd_maaa_num: 123 }))).toBe(
      "CSD/MAAA number must be a string or null",
    );
    expect(issue(companyPatchSchema.safeParse({ sars_tcs_pin: false }))).toBe(
      "SARS TCS PIN must be a string or null",
    );
  });

  it("normalizes blank optional values to null and ignores omitted fields", () => {
    const parsed = companyPatchSchema.safeParse({ csd_maaa_num: "  ", sars_tcs_pin: null });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ csd_maaa_num: null, sars_tcs_pin: null });
    expect(companyPatchSchema.safeParse({}).data).toEqual({});
  });
});

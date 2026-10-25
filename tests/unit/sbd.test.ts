import { describe, expect, it } from "vite-plus/test";

import { extractTextFromPdfBytes } from "@/lib/compliance";
import { generateSbdForm } from "@/lib/sbd";

const fullCompany = {
  companyName: "Vektor Test Pty Ltd",
  cipcNum: "2021/123456/07",
  csdMaaaNum: "MAAA0123456",
  sarsTcsPin: "1234567890",
  cidbCrsNum: "4GB",
  bbbeeLevel: 2,
  authorisedSignatoryName: "Jane Doe",
  authorisedSignatoryPosition: "Director",
};

const minimalCompany = {
  companyName: "Minimal Co",
  cipcNum: "2020/000001/07",
};

const tenderFull = {
  tenderNumber: "MUN/2024-INFRA-045",
  title: "Supply and Delivery of Electrical Components for Municipal Infrastructure",
  issuingEntity: "City of Tshwane Metropolitan Municipality",
  closingDate: "2025-03-15",
};

const tenderMinimal = {
  title: "South African Tender",
};

async function pdfText(
  company: Parameters<typeof generateSbdForm>[0],
  tender: Parameters<typeof generateSbdForm>[1],
  form: "sbd4" | "sbd61",
) {
  return extractTextFromPdfBytes(await generateSbdForm(company, tender, form));
}

describe("generated SBD 4 declaration", () => {
  it("prints the bidder identity and N/A for optional fields the company lacks", async () => {
    const text = await pdfText(minimalCompany, tenderFull, "sbd4");
    expect(text).toContain("Minimal Co");
    expect(text).toContain("2020/000001/07");
    expect(text).toContain("N/A");
    expect(text).toContain("MUN/2024-INFRA-045");
    expect(text).toContain("City of Tshwane Metropolitan Municipality");
  });

  it("marks tender fields the tender does not state as to be inserted", async () => {
    const text = await pdfText(fullCompany, tenderMinimal, "sbd4");
    expect(text).toContain("Vektor Test Pty Ltd");
    expect(text).toContain("MAAA0123456");
    expect(text).toContain("To be inserted");
    expect(text).toContain("South African Tender");
  });

  it("renders XML-sensitive characters without breaking the PDF", async () => {
    const text = await pdfText(
      { ...minimalCompany, companyName: "A & B <Test> Co" },
      { ...tenderMinimal, title: "Bid <special> & chars" },
      "sbd4",
    );
    expect(text).toContain("A & B");
    expect(text).toContain("<special>");
  });
});

describe("generated SBD 6.1 preference claim", () => {
  it("defaults to the 80/20 system and prints the B-BBEE level and claimed points", async () => {
    const text = await pdfText(fullCompany, { ...tenderFull, eligibleBbbeePoints: 14 }, "sbd61");
    expect(text).toContain("80/20");
    expect(text).toContain("Level 2");
    expect(text).toContain("14 / 20");
  });

  it("uses the 90/10 system and its cap when the tender requires it", async () => {
    const text = await pdfText(
      fullCompany,
      { ...tenderFull, preferencePointSystem: "90/10", eligibleBbbeePoints: 7 },
      "sbd61",
    );
    expect(text).toContain("90/10");
    expect(text).toContain("7 / 10");
  });

  it("shows N/A when the company has no B-BBEE level", async () => {
    const text = await pdfText(minimalCompany, tenderFull, "sbd61");
    expect(text).toContain("N/A");
  });
});

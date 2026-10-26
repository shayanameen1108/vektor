import { describe, expect, it } from "vite-plus/test";

import { localTenderAnalysis } from "@/lib/local-tender-analysis";

/** The text unpdf extracts from tests/fixtures/tender-4eb.pdf. */
const TENDER_4EB = `CITY OF TSHWANE METROPOLITAN MUNICIPALITY
INVITATION TO BID: MUN/2024/INFRA-045
Bid description: Supply and Delivery of Electrical Components
for Municipal Infrastructure programmes.
Tender required CIDB 4EB or higher.
A compulsory clarification meeting will be held on site.
Closing date: 2025-03-15 at 11:00.`;

describe("local tender analysis stand-in", () => {
  it("reads the facts the e2e fixture prints", () => {
    expect(localTenderAnalysis(TENDER_4EB)).toEqual({
      tender_title: "Supply and Delivery of Electrical Components",
      tender_number: "MUN/2024/INFRA-045",
      issuing_entity: "CITY OF TSHWANE METROPOLITAN MUNICIPALITY",
      required_cidb: "4EB or higher",
      closing_date: "2025-03-15",
      mandatory_returnables: [
        "CIDB registration (4EB or higher)",
        "Attendance at the compulsory clarification meeting",
      ],
      evaluation_criteria: [],
    });
  });

  it("recognises returnables, criteria and written-out closing dates", () => {
    const result = localTenderAnalysis(
      [
        "Department of Public Works",
        "Tender No: DPW-07/2026",
        "Submit SBD 1, SBD 4 and SBD 6.1 with a valid tax compliance status PIN.",
        "Evaluated on the 80/20 preference point system after functionality.",
        "Closing date: 24 Aug 2026",
      ].join("\n"),
    );
    expect(result.tender_number).toBe("DPW-07/2026");
    expect(result.required_cidb).toBeNull();
    expect(result.closing_date).toBe("2026-08-24");
    expect(result.mandatory_returnables).toEqual([
      "SBD 1 – Invitation to bid",
      "SBD 4 – Bidder's disclosure",
      "SBD 6.1 – Preference points claim",
      "Tax compliance status PIN",
    ]);
    expect(result.evaluation_criteria).toEqual(["80/20 preference point system", "Functionality"]);
  });

  it("returns null for facts the text does not state", () => {
    const result = localTenderAnalysis("Some document\nClosing date: 31 February 2026");
    expect(result.tender_title).toBe("Some document");
    expect(result.tender_number).toBeNull();
    expect(result.issuing_entity).toBeNull();
    expect(result.closing_date).toBeNull();
    expect(result.mandatory_returnables).toEqual([]);
  });
});

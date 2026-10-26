/**
 * South African construction Bargaining Councils reference data.
 * Ported verbatim from backend/bargaining_councils.py
 */

export interface BargainingCouncil {
  code: string;
  name: string;
  scope: string;
  sectors: string[];
  cidb_classes: string[];
  regions?: string[];
  evidence?: string;
  website?: string | null;
}

export const COUNCILS: BargainingCouncil[] = [
  {
    code: "BCCEI",
    name: "Bargaining Council for the Civil Engineering Industry",
    scope: "National",
    sectors: ["Civil Engineering"],
    cidb_classes: ["CE"],
    evidence: "Registration + Letter of Good Standing (levies paid)",
    website: "https://www.bccei.co.za",
  },
  {
    code: "NBCEI",
    name: "National Bargaining Council for the Electrical Industry of South Africa",
    scope: "National",
    sectors: ["Electrical"],
    cidb_classes: ["EB", "EP"],
    evidence: "Registration + Compliance Certificate (levies paid)",
    website: "https://www.nbcei.co.za",
  },
  {
    code: "MEIBC",
    name: "Metal and Engineering Industries Bargaining Council",
    scope: "National",
    sectors: ["Mechanical / Metal / Engineering", "HVAC / Refrigeration"],
    cidb_classes: ["ME"],
    evidence:
      "MEIBC registration + Compliance Certificate. HVAC contractors additionally require SARACCA membership and SAQCC Gas practitioner registration.",
    website: "https://www.meibc.co.za",
  },
  {
    code: "BIBC_WC",
    name: "Building Industry Bargaining Council (Cape of Good Hope)",
    scope: "Regional",
    sectors: ["Building / General Building"],
    cidb_classes: ["GB"],
    regions: ["Western Cape", "Cape Peninsula", "Boland", "Malmesbury", "Overstrand"],
    evidence: "Registration + Letter of Good Standing",
    website: "https://www.bibc.co.za",
  },
  {
    code: "BIBC_SEC",
    name: "Building Industry Bargaining Council (Southern & Eastern Cape)",
    scope: "Regional",
    sectors: ["Building / General Building"],
    cidb_classes: ["GB"],
    regions: ["Southern Cape", "Eastern Cape"],
    evidence: "Registration + Letter of Good Standing",
    website: "https://www.bibcpe.co.za",
  },
  {
    code: "BIBC_EL",
    name: "Building Industry Bargaining Council (East London)",
    scope: "Regional",
    sectors: ["Building / General Building"],
    cidb_classes: ["GB"],
    regions: ["East London", "Border"],
    evidence: "Registration + Letter of Good Standing",
    website: null,
  },
  {
    code: "BIBC_KIM",
    name: "Building Industry Bargaining Council (Kimberley)",
    scope: "Regional",
    sectors: ["Building / General Building"],
    cidb_classes: ["GB"],
    regions: ["Kimberley", "Northern Cape"],
    evidence: "Registration + Letter of Good Standing",
    website: null,
  },
  {
    code: "BCBI_BFN",
    name: "Bargaining Council for the Building Industry (Bloemfontein)",
    scope: "Regional",
    sectors: ["Building / General Building"],
    cidb_classes: ["GB"],
    regions: ["Bloemfontein", "Free State"],
    evidence: "Registration + Letter of Good Standing",
    website: null,
  },
];

export const VALID_COUNCIL_CODES = new Set(COUNCILS.map((c) => c.code));

export function councilsForCidbClass(cidbClass: string | null | undefined): BargainingCouncil[] {
  if (!cidbClass) return [];
  const cls = cidbClass.toUpperCase();
  return COUNCILS.filter((c) => c.cidb_classes.includes(cls));
}

export function listCouncilsPublic(): Omit<BargainingCouncil, "evidence">[] {
  return COUNCILS.map((c) => ({
    code: c.code,
    name: c.name,
    scope: c.scope,
    sectors: c.sectors,
    cidb_classes: c.cidb_classes,
    regions: c.regions,
    website: c.website ?? null,
  }));
}

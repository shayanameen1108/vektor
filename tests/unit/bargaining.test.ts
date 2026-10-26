import { describe, expect, it } from "vitest";

import { councilsForCidbClass } from "@/lib/bargaining-councils";

describe("bargaining council inference", () => {
  it("maps civil, electrical, and mechanical classes", () => {
    expect(councilsForCidbClass("CE").map((council) => council.code)).toEqual(["BCCEI"]);
    expect(councilsForCidbClass("EB").map((council) => council.code)).toEqual(["NBCEI"]);
    expect(councilsForCidbClass("EP").map((council) => council.code)).toEqual(["NBCEI"]);
    expect(councilsForCidbClass("ME").map((council) => council.code)).toEqual(["MEIBC"]);
  });

  it("maps general building to all regional councils", () => {
    expect(councilsForCidbClass("GB").map((council) => council.code)).toEqual([
      "BIBC_WC",
      "BIBC_SEC",
      "BIBC_EL",
      "BIBC_KIM",
      "BCBI_BFN",
    ]);
  });

  it("is case-insensitive and returns none for unknown classes", () => {
    expect(councilsForCidbClass("ce").map((council) => council.code)).toEqual(["BCCEI"]);
    expect(councilsForCidbClass("XX")).toEqual([]);
    expect(councilsForCidbClass(null)).toEqual([]);
  });
});

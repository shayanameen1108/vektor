import { describe, expect, it } from "vitest";

import { buildTrustedOrigins, expandWithWwwVariants } from "@/lib/auth/trusted-origins";

describe("expandWithWwwVariants", () => {
  it("expands the apex domain with its www counterpart", () => {
    expect(expandWithWwwVariants("https://vektorhq.co.za")).toEqual([
      "https://vektorhq.co.za",
      "https://www.vektorhq.co.za",
    ]);
  });

  it("expands the www domain with its apex counterpart", () => {
    expect(expandWithWwwVariants("https://www.vektorhq.co.za")).toEqual([
      "https://www.vektorhq.co.za",
      "https://vektorhq.co.za",
    ]);
  });

  it("does not add www variants for local origins", () => {
    expect(expandWithWwwVariants("http://127.0.0.1:4173")).toEqual(["http://127.0.0.1:4173"]);
    expect(expandWithWwwVariants("http://localhost:5173")).toEqual(["http://localhost:5173"]);
  });

  it("ignores empty values", () => {
    expect(expandWithWwwVariants(undefined)).toEqual([]);
    expect(expandWithWwwVariants("  ")).toEqual([]);
  });
});

describe("buildTrustedOrigins", () => {
  it("trusts both apex and www when only the apex is configured", () => {
    const origins = buildTrustedOrigins("https://vektorhq.co.za", undefined);
    expect(origins).toContain("https://vektorhq.co.za");
    expect(origins).toContain("https://www.vektorhq.co.za");
  });

  it("keeps local dev origins trusted", () => {
    const origins = buildTrustedOrigins("https://vektorhq.co.za");
    expect(origins).toContain("http://127.0.0.1:4173");
    expect(origins).toContain("http://localhost:5173");
  });
});

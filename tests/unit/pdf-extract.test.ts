import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { extractTextFromPdfBytes } from "@/lib/compliance";

describe("extractTextFromPdfBytes", () => {
  it("reads the committed tender fixture without corrupting the buffer", async () => {
    const original = new Uint8Array(
      readFileSync(join(import.meta.dirname, "../fixtures/tender-4eb.pdf")),
    );
    const snapshot = original.slice();
    const text = await extractTextFromPdfBytes(original, 2);
    expect(text).toMatch(/CITY OF TSHWANE/i);
    expect(text).toMatch(/4EB/i);
    expect(original).toEqual(snapshot);
  });
});

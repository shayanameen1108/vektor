import { readFileSync } from "node:fs";
import { join } from "node:path";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures");

export interface PdfInput {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

/**
 * Load a committed PDF fixture for setInputFiles. The fixtures are real
 * pdf-lib-generated documents so the Worker's unpdf extraction path is
 * exercised end to end (not a plain-text stand-in).
 */
export function pdfFixture(name: string): PdfInput {
  return {
    name,
    mimeType: "application/pdf",
    buffer: readFileSync(join(FIXTURES_DIR, name)),
  };
}

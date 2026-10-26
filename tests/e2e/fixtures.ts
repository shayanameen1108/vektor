import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PDFDocument, StandardFonts } from "pdf-lib";

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

/**
 * Build a real one-page PDF on the fly (for tests that need dynamic printed
 * dates). Uses pdf-lib — the same library the Worker uses for SBD output —
 * so the bytes are genuine compressed PDFs that unpdf parses.
 */
export async function makePdf(name: string, lines: string[]): Promise<PdfInput> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let y = 760;
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 12, font });
    y -= 24;
  }
  return { name, mimeType: "application/pdf", buffer: Buffer.from(await doc.save()) };
}

import { createFileRoute } from "@tanstack/react-router";

import {
  type DocType,
  NEEDS_EXPIRY_TYPES,
  extractBbbeeLevelFromText,
  extractExpiryFromText,
  extractTextFromPdfBytes,
} from "@/lib/compliance";
import { requireUser } from "@/lib/server-auth";

export const Route = createFileRoute("/api/documents/preview-bbbee")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await requireUser(request);
        if (session instanceof Response) return session;

        // Peek inside a compliance-cert PDF BEFORE the contractor submits the
        // upload form, so we can pre-fill the expiry field. Nothing is persisted.
        const formData = await request.formData().catch(() => null);
        if (!formData) return Response.json({ detail: "Invalid form data" }, { status: 400 });

        const file = formData.get("file");
        const docTypeRaw = formData.get("doc_type");
        const docType = typeof docTypeRaw === "string" && docTypeRaw ? docTypeRaw : "BBBEE";

        const empty = { extracted_bbbee_level: null, extracted_expiry_date: null };
        if (!(file instanceof File) || file.size > 10 * 1024 * 1024) {
          return Response.json(empty);
        }

        const isPdf =
          file.type.toLowerCase() === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (!isPdf) return Response.json(empty);

        try {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const text = await extractTextFromPdfBytes(bytes, 5);
          const expiry = NEEDS_EXPIRY_TYPES.has(docType as DocType)
            ? extractExpiryFromText(text)
            : null;
          const level = docType === "BBBEE" ? extractBbbeeLevelFromText(text) : null;
          return Response.json({ extracted_bbbee_level: level, extracted_expiry_date: expiry });
        } catch {
          return Response.json(empty);
        }
      },
    },
  },
});

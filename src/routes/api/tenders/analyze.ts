import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { createDb } from "@/db";
import { analyzeTenderWithAi } from "@/lib/ai";
import { fetchOwnedCompany } from "@/lib/ownership";
import { asString } from "@/lib/request-utils";
import { requireUser } from "@/lib/server-auth";
import { analyzeTender } from "@/lib/tender-analysis.server";

/** Protects Worker memory while allowing normal municipal tender packs. */
const MAX_TENDER_BYTES = 20 * 1024 * 1024;

export const Route = createFileRoute("/api/tenders/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await requireUser(request);
        if (session instanceof Response) return session;

        const formData = await request.formData().catch(() => null);
        if (!formData) return Response.json({ detail: "Invalid form data" }, { status: 400 });
        const file = formData.get("file");
        const companyId = asString(formData.get("company_id"));
        const preferenceSystem = formData.get("preference_system") === "90/10" ? "90/10" : "80/20";

        if (!(file instanceof File))
          return Response.json({ detail: "File is required" }, { status: 400 });
        if (!companyId) return Response.json({ detail: "company_id is required" }, { status: 400 });
        if (file.size === 0)
          return Response.json({ detail: "Uploaded file is empty" }, { status: 400 });
        if (file.size > MAX_TENDER_BYTES) {
          return Response.json({ detail: "Tender PDF is too large (max 20MB)" }, { status: 400 });
        }
        if (
          file.type.toLowerCase() !== "application/pdf" &&
          !file.name.toLowerCase().endsWith(".pdf")
        ) {
          return Response.json({ detail: "Only PDF files are supported" }, { status: 400 });
        }

        const db = createDb(env.DB);
        const company = await fetchOwnedCompany(db, companyId, session);
        if (company instanceof Response) return company;

        const bytes = new Uint8Array(await file.arrayBuffer());
        if (!hasPdfMagic(bytes)) {
          return Response.json({ detail: "The uploaded file is not a valid PDF" }, { status: 400 });
        }

        const outcome = await analyzeTender(
          db,
          { storage: env.STORAGE, analyze: analyzeTenderWithAi },
          { company, bytes, preferenceSystem },
        );
        if (!outcome.ok) {
          return Response.json({ detail: outcome.detail }, { status: outcome.status });
        }
        return Response.json(outcome.analysis);
      },
    },
  },
});

function hasPdfMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
}

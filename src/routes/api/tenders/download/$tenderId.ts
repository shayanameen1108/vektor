import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { createDb } from "@/db";
import { fetchOwnedTender } from "@/lib/ownership";
import { r2Response } from "@/lib/r2-response";
import { requireUser } from "@/lib/server-auth";

export const Route = createFileRoute("/api/tenders/download/$tenderId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await requireUser(request);
        if (session instanceof Response) return session;
        const owned = await fetchOwnedTender(createDb(env.DB), params.tenderId, session);
        if (owned instanceof Response) return owned;
        if (!owned.tender.pdfStorageKey) {
          return Response.json({ detail: "Tender PDF not found" }, { status: 404 });
        }
        const response = await r2Response({
          request,
          bucket: env.STORAGE,
          key: owned.tender.pdfStorageKey,
          filename: `tender-${params.tenderId}.pdf`,
          disposition: "attachment",
          fallbackContentType: "application/pdf",
        });
        return response ?? Response.json({ detail: "Tender PDF not found" }, { status: 404 });
      },
    },
  },
});

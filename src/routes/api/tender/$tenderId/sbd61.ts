import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { createDb } from "@/db";
import { fetchOwnedTender } from "@/lib/ownership";
import { requireUser } from "@/lib/server-auth";
import { generateSbdForm, sbdPdfResponse } from "@/lib/sbd";

export const Route = createFileRoute("/api/tender/$tenderId/sbd61")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await requireUser(request);
        if (session instanceof Response) return session;

        const owned = await fetchOwnedTender(createDb(env.DB), params.tenderId, session);
        if (owned instanceof Response) return owned;

        const pdfBytes = await generateSbdForm(owned.company, owned.tender, "sbd61");
        return sbdPdfResponse(params.tenderId, "sbd61", pdfBytes);
      },
    },
  },
});

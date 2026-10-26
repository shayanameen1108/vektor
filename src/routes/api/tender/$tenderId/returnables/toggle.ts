import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { createDb } from "@/db";
import { fetchOwnedTender } from "@/lib/ownership";
import { asString } from "@/lib/request-utils";
import { requireUser } from "@/lib/server-auth";
import { updateReturnables } from "@/lib/tender-returnables";
import { parseStringList } from "@/lib/utils";

export const Route = createFileRoute("/api/tender/$tenderId/returnables/toggle")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const session = await requireUser(request);
        if (session instanceof Response) return session;
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body) return Response.json({ detail: "Invalid JSON" }, { status: 400 });
        const returnableName = asString(body.returnable_name);
        if (!returnableName)
          return Response.json({ detail: "returnable_name is required" }, { status: 400 });

        const db = createDb(env.DB);
        const owned = await fetchOwnedTender(db, params.tenderId, session);
        if (owned instanceof Response) return owned;
        if (!parseStringList(owned.tender.parsedReturnables).includes(returnableName)) {
          return Response.json({ detail: "Unknown returnable for this tender" }, { status: 400 });
        }
        try {
          const result = await updateReturnables(db, params.tenderId, (status) => {
            const existing = status[returnableName];
            const verified = Boolean(body.verified);
            status[returnableName] = {
              verified,
              verified_at: verified ? new Date().toISOString() : null,
              doc_ref: existing?.doc_ref ?? null,
              file_name: existing?.file_name ?? null,
            };
            return status;
          });
          if (!result) return Response.json({ detail: "Tender not found" }, { status: 404 });
          return Response.json({ returnable_status: result.status });
        } catch (error) {
          // Retry exhaustion is expected under concurrency; anything else is a
          // real failure and must be visible in logs.
          console.error("Failed to update returnables", error);
          return Response.json({ detail: "Returnables changed; please retry" }, { status: 409 });
        }
      },
    },
  },
});

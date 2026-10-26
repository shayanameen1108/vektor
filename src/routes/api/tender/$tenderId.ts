import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { createDb } from "@/db";
import { fetchOwnedTender } from "@/lib/ownership";
import { toApiTender } from "@/lib/tender-api";
import { requireUser } from "@/lib/server-auth";

export const Route = createFileRoute("/api/tender/$tenderId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await requireUser(request);
        if (session instanceof Response) return session;

        const db = createDb(env.DB);
        const owned = await fetchOwnedTender(db, params.tenderId, session);
        if (owned instanceof Response) return owned;
        return Response.json(toApiTender(owned.tender));
      },
    },
  },
});

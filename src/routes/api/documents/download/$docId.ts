import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { createDb } from "@/db";
import { fetchOwnedDocument } from "@/lib/ownership";
import { r2Response } from "@/lib/r2-response";
import { requireUser } from "@/lib/server-auth";

export const Route = createFileRoute("/api/documents/download/$docId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await requireUser(request);
        if (session instanceof Response) return session;
        const owned = await fetchOwnedDocument(createDb(env.DB), params.docId, session);
        if (owned instanceof Response) return owned;
        if (!owned.document.storageKey) {
          return Response.json({ detail: "Document has no stored file" }, { status: 404 });
        }
        const response = await r2Response({
          request,
          bucket: env.STORAGE,
          key: owned.document.storageKey,
          filename: owned.document.fileName,
          disposition: "attachment",
        });
        return response ?? Response.json({ detail: "File not found in storage" }, { status: 404 });
      },
    },
  },
});

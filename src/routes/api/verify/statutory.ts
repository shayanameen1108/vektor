import { createFileRoute } from "@tanstack/react-router";

import { verify } from "@/lib/verification";

import { asString } from "@/lib/request-utils";
import { requireUser } from "@/lib/server-auth";

export const Route = createFileRoute("/api/verify/statutory")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await requireUser(request);
        if (session instanceof Response) return session;

        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body) return Response.json({ detail: "Invalid JSON" }, { status: 400 });

        const kind = asString(body.kind ?? "");
        const value = asString(body.value ?? "");
        const result = verify(kind, value);
        if (!result) {
          return Response.json(
            { detail: `Unknown verification kind '${kind}'. Use one of: cipc, sars, csd.` },
            { status: 400 },
          );
        }
        return Response.json(result);
      },
    },
  },
});

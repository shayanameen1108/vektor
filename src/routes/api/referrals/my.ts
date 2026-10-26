import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { createDb } from "@/db";
import { myStats } from "@/lib/referral";
import { requireUser } from "@/lib/server-auth";

export const Route = createFileRoute("/api/referrals/my")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await requireUser(request);
        if (session instanceof Response) return session;

        const db = createDb(env.DB);
        return Response.json(await myStats(db, session.user.id));
      },
    },
  },
});

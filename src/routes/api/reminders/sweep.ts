import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { createDb } from "@/db";
import { sweepAndSend } from "@/lib/reminder";
import { runtimeEnv } from "@/lib/runtime-env";
import { requireAdmin } from "@/lib/server-auth";

export const Route = createFileRoute("/api/reminders/sweep")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const adminSession = await requireAdmin(request);
        if (adminSession instanceof Response) return adminSession;
        try {
          return Response.json(await sweepAndSend(createDb(env.DB), runtimeEnv));
        } catch (error) {
          return Response.json(
            { detail: error instanceof Error ? error.message : String(error) },
            { status: 500 },
          );
        }
      },
    },
  },
});

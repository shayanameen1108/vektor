import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import { createDb } from "@/db";
import { user } from "@/db/schema/auth";
import { auth } from "@/lib/auth/auth";
import { requireAdmin } from "@/lib/server-auth";

export const Route = createFileRoute("/api/admin/impersonate/$userId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const adminCheck = await requireAdmin(request);
        if (adminCheck instanceof Response) return adminCheck;

        if (params.userId === adminCheck.user.id) {
          return Response.json({ detail: "You cannot impersonate yourself" }, { status: 400 });
        }

        const db = createDb(env.DB);
        const target = (
          await db.select({ role: user.role }).from(user).where(eq(user.id, params.userId))
        )[0];
        if (!target) return Response.json({ detail: "User not found" }, { status: 404 });
        if (target.role === "admin") {
          return Response.json({ detail: "You cannot impersonate another admin" }, { status: 400 });
        }

        // Canonical better-auth impersonation: creates an impersonation session
        // for the target user and returns the response with Set-Cookie headers.
        try {
          const response = await auth.api.impersonateUser({
            body: { userId: params.userId },
            headers: request.headers,
            asResponse: true,
          });
          return response;
        } catch (e) {
          console.error("Impersonation failed", e);
          return Response.json({ detail: "Impersonation failed" }, { status: 500 });
        }
      },
    },
  },
});

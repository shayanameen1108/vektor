import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { createDb } from "@/db";
import { toApiEftPayment } from "@/lib/eft-api";
import { rejectEft } from "@/lib/eft.server";
import { sendEftDecisionEmail } from "@/lib/reminder";
import { runtimeEnv } from "@/lib/runtime-env";
import { requireAdmin } from "@/lib/server-auth";

import { asString } from "@/lib/request-utils";

export const Route = createFileRoute("/api/eft/admin/$paymentId/reject")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const adminSession = await requireAdmin(request);
        if (adminSession instanceof Response) return adminSession;

        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const reason = asString(body?.reason ?? "").trim();
        if (!reason) {
          return Response.json({ detail: "Rejection reason is required" }, { status: 400 });
        }

        const db = createDb(env.DB);
        const result = await rejectEft(db, {
          paymentId: params.paymentId,
          adminUserId: adminSession.user.id,
          reason,
        });
        if (!result.ok) {
          return Response.json({ detail: result.detail }, { status: result.status });
        }

        await sendEftDecisionEmail(runtimeEnv, {
          to: result.payment.userEmail,
          type: "eft_rejection",
          reference: result.payment.reference,
          packageName: result.payment.packageName,
          amountRands: result.payment.amount / 100,
          reason,
        });
        return Response.json(toApiEftPayment(result.payment));
      },
    },
  },
});

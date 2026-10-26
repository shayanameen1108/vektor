import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { createDb } from "@/db";
import { toApiEftPayment } from "@/lib/eft-api";
import { confirmEft } from "@/lib/eft.server";
import { sendEftDecisionEmail } from "@/lib/reminder";
import { runtimeEnv } from "@/lib/runtime-env";
import { requireAdmin } from "@/lib/server-auth";

export const Route = createFileRoute("/api/eft/admin/$paymentId/confirm")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const adminSession = await requireAdmin(request);
        if (adminSession instanceof Response) return adminSession;

        const db = createDb(env.DB);
        const result = await confirmEft(db, {
          paymentId: params.paymentId,
          adminUserId: adminSession.user.id,
        });
        if (!result.ok) {
          return Response.json({ detail: result.detail }, { status: result.status });
        }

        if (result.newlyConfirmed) {
          await sendEftDecisionEmail(runtimeEnv, {
            to: result.payment.userEmail,
            type: "eft_confirmation",
            reference: result.payment.reference,
            packageName: result.payment.packageName,
            amountRands: result.payment.amount / 100,
            creditsGranted: result.payment.creditsGranted ?? 0,
            companyName: result.payment.companyName,
          });
        }
        if (result.referralPending) {
          return Response.json(
            {
              detail:
                "Payment confirmed; referral reward could not be completed. Retry confirmation.",
              payment: toApiEftPayment(result.payment),
            },
            { status: 503 },
          );
        }
        return Response.json(toApiEftPayment(result.payment));
      },
    },
  },
});

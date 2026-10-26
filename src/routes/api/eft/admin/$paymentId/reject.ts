import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { and, eq, isNull } from "drizzle-orm";

import { createDb } from "@/db";
import { eftPayments } from "@/db/schema/eft";
import { toApiEftPayment } from "@/lib/eft-api";
import { sendEftDecisionEmail } from "@/lib/reminder";
import { runtimeEnv } from "@/lib/runtime-env";
import { requireAdmin } from "@/lib/server-auth";

import { asString } from "@/lib/request-utils";

export const Route = createFileRoute("/api/eft/admin/$paymentId/reject")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const adminCheck = await requireAdmin(request);
        if (adminCheck instanceof Response) return adminCheck;

        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const reason = asString(body?.reason ?? "").trim();
        if (!reason) {
          return Response.json({ detail: "Rejection reason is required" }, { status: 400 });
        }

        const db = createDb(env.DB);
        const rows = await db
          .select()
          .from(eftPayments)
          .where(eq(eftPayments.id, params.paymentId));
        const payment = rows[0];
        if (!payment) return Response.json({ detail: "Payment not found" }, { status: 404 });
        if (payment.status !== "pending_review") {
          return Response.json(
            { detail: `Cannot reject a ${payment.status} payment` },
            { status: 400 },
          );
        }

        const now = new Date();
        const changed = await db
          .update(eftPayments)
          .set({
            status: "rejected",
            rejectReason: reason,
            rejectedAt: now,
            rejectedBy: adminCheck.user.id,
            updatedAt: now,
          })
          .where(
            and(
              eq(eftPayments.id, params.paymentId),
              eq(eftPayments.status, "pending_review"),
              isNull(eftPayments.processingToken),
            ),
          )
          .returning({ id: eftPayments.id });
        if (changed.length === 0) {
          return Response.json(
            { detail: "Payment state changed; refresh and try again" },
            { status: 409 },
          );
        }

        await sendEftDecisionEmail(runtimeEnv, {
          to: payment.userEmail,
          type: "eft_rejection",
          reference: payment.reference,
          packageName: payment.packageName,
          amountRands: payment.amount / 100,
          reason,
        });

        const updated = (
          await db.select().from(eftPayments).where(eq(eftPayments.id, params.paymentId))
        )[0]!;
        return Response.json(toApiEftPayment(updated));
      },
    },
  },
});

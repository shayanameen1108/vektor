import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import { createDb } from "@/db";
import { eftPayments } from "@/db/schema/eft";
import { rolloverCapForCycleCredits } from "@/lib/eft";
import { toApiEftPayment } from "@/lib/eft-api";
import { maybeRewardReferrerOnPaidEft } from "@/lib/referral";
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
        const payment = (
          await db.select().from(eftPayments).where(eq(eftPayments.id, params.paymentId))
        )[0];
        if (!payment) return Response.json({ detail: "Payment not found" }, { status: 404 });
        if (payment.status === "confirmed") return Response.json(toApiEftPayment(payment));
        if (payment.status !== "pending_review") {
          return Response.json(
            { detail: `Payment must be in pending_review, currently ${payment.status}` },
            { status: 400 },
          );
        }

        const token = crypto.randomUUID();
        const now = Math.floor(Date.now() / 1000);
        const rolloverCap = rolloverCapForCycleCredits(payment.credits);
        const results = await env.DB.batch([
          env.DB.prepare(
            `UPDATE eft_payments
             SET processingToken = ?, updatedAt = ?, creditsGranted = CASE
               WHEN type = 'subscription' THEN max(
                 0,
                 max(
                   coalesce((SELECT credits FROM company_credits WHERE companyId = eft_payments.companyId), 0),
                   min(
                     coalesce((SELECT credits FROM company_credits WHERE companyId = eft_payments.companyId), 0) + credits,
                     ?
                   )
                 ) - coalesce((SELECT credits FROM company_credits WHERE companyId = eft_payments.companyId), 0)
               )
               ELSE credits
             END
             WHERE id = ? AND status = 'pending_review' AND processingToken IS NULL`,
          ).bind(token, now, rolloverCap, payment.id),
          env.DB.prepare(
            `INSERT INTO company_credits
              (companyId, credits, subscriptionLookupKey, subscriptionCycleCredits,
               subscriptionRolloverCap, subscriptionStartedAt, subscriptionActive, updatedAt)
             SELECT companyId, creditsGranted,
               CASE WHEN type = 'subscription' THEN lookupKey ELSE NULL END,
               CASE WHEN type = 'subscription' THEN credits ELSE NULL END,
               CASE WHEN type = 'subscription' THEN ? ELSE NULL END,
               CASE WHEN type = 'subscription' THEN ? ELSE NULL END,
               CASE WHEN type = 'subscription' THEN 1 ELSE 0 END, ?
             FROM eft_payments WHERE id = ? AND processingToken = ?
             ON CONFLICT(companyId) DO UPDATE SET
               credits = CASE
                 WHEN excluded.subscriptionActive = 1 THEN max(
                   company_credits.credits,
                   min(company_credits.credits + excluded.credits, excluded.subscriptionRolloverCap)
                 )
                 ELSE company_credits.credits + excluded.credits
               END,
               subscriptionLookupKey = CASE WHEN excluded.subscriptionActive = 1 THEN excluded.subscriptionLookupKey ELSE company_credits.subscriptionLookupKey END,
               subscriptionCycleCredits = CASE WHEN excluded.subscriptionActive = 1 THEN excluded.subscriptionCycleCredits ELSE company_credits.subscriptionCycleCredits END,
               subscriptionRolloverCap = CASE WHEN excluded.subscriptionActive = 1 THEN excluded.subscriptionRolloverCap ELSE company_credits.subscriptionRolloverCap END,
               subscriptionStartedAt = CASE WHEN excluded.subscriptionActive = 1 THEN excluded.subscriptionStartedAt ELSE company_credits.subscriptionStartedAt END,
               subscriptionActive = CASE WHEN excluded.subscriptionActive = 1 THEN 1 ELSE company_credits.subscriptionActive END,
               updatedAt = excluded.updatedAt`,
          ).bind(rolloverCap, now, now, payment.id, token),
          env.DB.prepare(
            `UPDATE eft_payments
             SET status = 'confirmed', confirmedAt = ?, confirmedBy = ?,
                 processingToken = NULL, updatedAt = ?
             WHERE id = ? AND processingToken = ?`,
          ).bind(now, adminSession.user.id, now, payment.id, token),
        ]);

        const won = Number(results[0]!.meta.changes ?? 0) === 1;
        const durable = (
          await db.select().from(eftPayments).where(eq(eftPayments.id, payment.id))
        )[0];
        if (!durable) return Response.json({ detail: "Payment not found" }, { status: 404 });
        if (!won) {
          if (durable.status === "confirmed") return Response.json(toApiEftPayment(durable));
          return Response.json(
            { detail: "Payment state changed; refresh and try again" },
            { status: 409 },
          );
        }

        await sendEftDecisionEmail(runtimeEnv, {
          to: durable.userEmail,
          type: "eft_confirmation",
          reference: durable.reference,
          packageName: durable.packageName,
          amountRands: durable.amount / 100,
          creditsGranted: durable.creditsGranted ?? 0,
          companyName: durable.companyName,
        });
        try {
          await maybeRewardReferrerOnPaidEft(
            db,
            {
              refereeUserId: durable.userId,
              isSubscription: durable.type === "subscription",
              triggerReference: durable.reference,
              planLookupKey: durable.lookupKey,
            },
            env.DB,
          );
        } catch (error) {
          console.error("Failed to process referral reward", error);
        }

        return Response.json(toApiEftPayment(durable));
      },
    },
  },
});

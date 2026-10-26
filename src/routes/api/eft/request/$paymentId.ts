import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { createDb } from "@/db";
import { eftPayments } from "@/db/schema/eft";
import { fetchOwnedEftPayment } from "@/lib/ownership";
import { deleteQuietly } from "@/lib/r2-response";
import { requireUser } from "@/lib/server-auth";

export const Route = createFileRoute("/api/eft/request/$paymentId")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const session = await requireUser(request);
        if (session instanceof Response) return session;

        const db = createDb(env.DB);
        const owned = await fetchOwnedEftPayment(db, params.paymentId, session);
        if (owned instanceof Response) return owned;
        const payment = owned.payment;
        // Cancellation is only possible while the request is still with the
        // customer (awaiting_proof / pending_review). confirmed and rejected
        // records are part of the audit trail.
        if (payment.status !== "awaiting_proof" && payment.status !== "pending_review") {
          return Response.json(
            { detail: `Cannot cancel a ${payment.status} payment` },
            { status: 400 },
          );
        }

        const deleted = await db
          .delete(eftPayments)
          .where(
            and(
              eq(eftPayments.id, params.paymentId),
              eq(eftPayments.userId, session.user.id),
              inArray(eftPayments.status, ["awaiting_proof", "pending_review"]),
              isNull(eftPayments.processingToken),
            ),
          )
          .returning({ id: eftPayments.id, proofPath: eftPayments.proofPath });
        if (!deleted[0]) {
          return Response.json(
            { detail: "Payment state changed; refresh and try again" },
            { status: 409 },
          );
        }
        if (deleted[0].proofPath) {
          await deleteQuietly(env.STORAGE, deleted[0].proofPath, "cancelled EFT proof");
        }
        return Response.json({ status: "cancelled", id: params.paymentId });
      },
    },
  },
});

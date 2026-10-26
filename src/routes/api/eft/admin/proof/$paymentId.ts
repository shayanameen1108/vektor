import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import { createDb } from "@/db";
import { eftPayments } from "@/db/schema/eft";
import { r2Response } from "@/lib/r2-response";
import { requireAdmin } from "@/lib/server-auth";

export const Route = createFileRoute("/api/eft/admin/proof/$paymentId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const adminSession = await requireAdmin(request);
        if (adminSession instanceof Response) return adminSession;
        const payment = (
          await createDb(env.DB)
            .select()
            .from(eftPayments)
            .where(eq(eftPayments.id, params.paymentId))
        )[0];
        if (!payment?.proofPath)
          return Response.json({ detail: "Proof not found" }, { status: 404 });
        const response = await r2Response({
          request,
          bucket: env.STORAGE,
          key: payment.proofPath,
          filename: payment.proofFilename ?? "proof",
          disposition: "inline",
          fallbackContentType: payment.proofContentType ?? undefined,
        });
        return response ?? Response.json({ detail: "Proof not found" }, { status: 404 });
      },
    },
  },
});

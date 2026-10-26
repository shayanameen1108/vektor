import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { createDb } from "@/db";
import { fetchOwnedCompany } from "@/lib/ownership";
import { buildTestAlertHtml } from "@/lib/reminder-template";
import { sendViaResend } from "@/lib/reminder";
import { runtimeEnv } from "@/lib/runtime-env";
import { requireUser } from "@/lib/server-auth";

/**
 * Compliance Guardian "send test alert" button (Company Setup). Sends one
 * confirmation email straight to the company contact — no document is
 * involved and no `sent_reminders` idempotency rows are written.
 */
export const Route = createFileRoute("/api/reminders/test/$companyId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const session = await requireUser(request);
        if (session instanceof Response) return session;

        const db = createDb(env.DB);
        const company = await fetchOwnedCompany(db, params.companyId, session);
        if (company instanceof Response) return company;

        const to = (company.contactEmail || "").trim();
        if (!to) {
          return Response.json(
            { detail: "Add a contact email before sending a test alert." },
            { status: 400 },
          );
        }
        if (!company.alertsEnabled) {
          return Response.json(
            { detail: "Enable expiry alerts before sending a test alert." },
            { status: 400 },
          );
        }

        const html = buildTestAlertHtml({
          companyName: company.companyName || "Bidder",
          appUrl: (runtimeEnv.APP_URL || "").replace(/\/$/, ""),
        });
        try {
          const resendId = await sendViaResend(
            runtimeEnv,
            to,
            "[Vektor] Test alert — Compliance Guardian",
            html,
          );
          return Response.json({ status: "sent", to, resendId });
        } catch (error) {
          return Response.json(
            {
              detail: `Test send failed: ${error instanceof Error ? error.message : String(error)}`,
            },
            { status: 502 },
          );
        }
      },
    },
  },
});

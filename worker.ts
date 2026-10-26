/**
 * Cloudflare Worker entry for TanStack Start.
 *
 * Composes the framework fetch handler and Compliance Guardian cron in one
 * default Worker handler object (08:00 SAST = 0 6 * * * UTC).
 */
import serverEntry from "@tanstack/react-start/server-entry";
import { createDb } from "@/db";
import { sweepAndSend } from "@/lib/reminder";
import type { RuntimeEnv } from "@/lib/runtime-env";

export default {
  fetch(request) {
    return serverEntry.fetch(request);
  },
  scheduled(_controller, workerEnv, ctx) {
    ctx.waitUntil(
      sweepAndSend(createDb(workerEnv.DB), workerEnv)
        .then(({ sent, skipped, failed }) => {
          console.log("[cron] compliance sweep done", { sent, skipped, failed });
        })
        .catch((error) => {
          console.error("[cron] compliance sweep failed", error);
        }),
    );
  },
} satisfies ExportedHandler<RuntimeEnv>;

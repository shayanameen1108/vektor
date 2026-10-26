import { defineScheduled } from "void";

import { createDb } from "@/db";
import type { RuntimeEnv } from "@/lib/runtime-env";
import { sweepAndSend } from "@/lib/reminder";

/** Compliance Guardian: daily reminders at 08:00 SAST (0 6 * * * UTC). */
export const cron = "0 6 * * *";

export default defineScheduled(async (_controller, env, ctx) => {
  const workerEnv = env as RuntimeEnv;
  const run = sweepAndSend(createDb(workerEnv.DB), workerEnv)
    .then(({ sent, skipped, failed }) => {
      console.log("[cron] compliance sweep done", { sent, skipped, failed });
    })
    .catch((error) => {
      console.error("[cron] compliance sweep failed", error);
    });
  ctx?.waitUntil?.(run);
  await run;
});

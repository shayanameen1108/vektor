import { env } from "cloudflare:workers";

/** Secrets and vars configured for the Worker in addition to generated bindings. */
/** "local" in .env swaps in the local adapters (src/lib/ports.ts). */
export type RuntimeEnv = Cloudflare.Env & typeof import("../../env").default;

export const runtimeEnv = env as unknown as RuntimeEnv;

export interface MailEnv {
  ENVIRONMENT?: string;
  APP_URL?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  SENDER_EMAIL?: string;
  SENDER_NAME?: string;
  SUPPORT_EMAIL?: string;
}

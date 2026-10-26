import { env } from "cloudflare:workers";

/** Secrets and vars configured with Wrangler in addition to generated bindings. */
export type RuntimeEnv = Env & {
  AI: Ai;
  APP_URL?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  EFT_BANK_NAME?: string;
  EFT_ACCOUNT_HOLDER?: string;
  EFT_ACCOUNT_NUMBER?: string;
  EFT_BRANCH_CODE?: string;
  EFT_ACCOUNT_TYPE?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  SENDER_EMAIL?: string;
  SENDER_NAME?: string;
  SUPPORT_EMAIL?: string;
};

export const runtimeEnv = env as unknown as RuntimeEnv;

export interface MailEnv {
  APP_URL?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  SENDER_EMAIL?: string;
  SENDER_NAME?: string;
  SUPPORT_EMAIL?: string;
}

import { defineEnv, string } from "void/env";

// Server secrets/vars (optional so local/CI can run without every key).
// Production values stay Worker secrets (`void secret put`). Client VITE_*
// keys can be added here later. Native cloudflare:workers / import.meta.env
// access stays intentional for module-scope Better Auth and port adapters.
export default defineEnv({
  ENVIRONMENT: string().optional(),
  APP_URL: string().optional(),
  BETTER_AUTH_URL: string().optional(),
  BETTER_AUTH_SECRET: string().optional(),
  GOOGLE_CLIENT_ID: string().optional(),
  GOOGLE_CLIENT_SECRET: string().optional(),
  RESEND_API_KEY: string().optional(),
  EMAIL_FROM: string().optional(),
  SENDER_EMAIL: string().optional(),
  SENDER_NAME: string().optional(),
  SUPPORT_EMAIL: string().optional(),
  EFT_BANK_NAME: string().optional(),
  EFT_ACCOUNT_HOLDER: string().optional(),
  EFT_ACCOUNT_NUMBER: string().optional(),
  EFT_BRANCH_CODE: string().optional(),
  EFT_ACCOUNT_TYPE: string().optional(),
});

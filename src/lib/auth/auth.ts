import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { waitUntil } from "cloudflare:workers";

import { createDb } from "@/db";
import * as schema from "@/db/schema";
import { buildTrustedOrigins } from "@/lib/auth/trusted-origins";
import { ensureReferralCode, recordSignup } from "@/lib/referral";
import { sendEmail } from "@/lib/reminder";
import { buildPasswordResetHtml } from "@/lib/reminder-template";
import { runtimeEnv } from "@/lib/runtime-env";

const db = createDb(runtimeEnv.DB);

/** The only application auth instance, bound to the Worker's D1 binding. */
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          try {
            await ensureReferralCode(db, createdUser.id);
          } catch {
            // Referral codes are recoverable through the referral dashboard.
          }
          const code =
            typeof createdUser.referredByCode === "string" ? createdUser.referredByCode : undefined;
          if (code) {
            try {
              await recordSignup(db, createdUser.id, createdUser.email, code, runtimeEnv.DB);
            } catch {
              // Attribution must never prevent account creation.
            }
          }
        },
      },
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "user", input: false },
      referralCode: { type: "string", required: false, input: false },
      referredByUserId: { type: "string", required: false, input: false },
      referredByCode: { type: "string", required: false, input: true },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const appUrl = (runtimeEnv.APP_URL || runtimeEnv.BETTER_AUTH_URL || "").replace(/\/$/, "");
      const delivery = sendEmail(
        runtimeEnv,
        user.email,
        "[Vektor] Reset your password",
        buildPasswordResetHtml({ url, appUrl }),
      ).catch((error) => {
        console.error("Password reset email delivery failed", error);
      });
      waitUntil(delivery);
    },
  },
  secret: runtimeEnv.BETTER_AUTH_SECRET,
  baseURL: runtimeEnv.BETTER_AUTH_URL ?? runtimeEnv.APP_URL,
  socialProviders: {
    google: {
      clientId: runtimeEnv.GOOGLE_CLIENT_ID ?? "",
      clientSecret: runtimeEnv.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  // `vp run dev` is :5173 and preview/e2e is :4173. Trust both local
  // origins so cookies and CSRF checks work regardless of which port is up.
  // Configured public URLs are expanded with their apex/www counterparts so
  // login works on both https://vektorhq.co.za and https://www.vektorhq.co.za.
  trustedOrigins: buildTrustedOrigins(runtimeEnv.BETTER_AUTH_URL, runtimeEnv.APP_URL),
  plugins: [admin(), tanstackStartCookies()],
});

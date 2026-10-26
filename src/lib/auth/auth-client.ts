import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [adminClient()],
});

/**
 * The server adds role / referralCode / impersonation fields that the client
 * bundle cannot infer from the Worker-only auth factory. Every read site goes
 * through this single narrowing point instead of casting ad hoc.
 */
export interface VektorSessionData {
  user?: {
    id: string;
    email: string;
    name?: string | null;
    role?: "admin" | "user" | null;
    referralCode?: string | null;
  } | null;
  session?: { id: string; impersonatedBy?: string | null } | null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function asVektorSession(data: unknown): VektorSessionData | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const user = record.user;
  const session = record.session;
  if (!user || typeof user !== "object") return { user: null, session: null };
  const userRecord = user as Record<string, unknown>;
  const sessionRecord =
    session && typeof session === "object" ? (session as Record<string, unknown>) : null;
  return {
    user: {
      id: asString(userRecord.id),
      email: asString(userRecord.email),
      name: typeof userRecord.name === "string" ? userRecord.name : null,
      role: userRecord.role === "admin" || userRecord.role === "user" ? userRecord.role : null,
      referralCode: typeof userRecord.referralCode === "string" ? userRecord.referralCode : null,
    },
    session: sessionRecord
      ? {
          id: asString(sessionRecord.id),
          impersonatedBy:
            typeof sessionRecord.impersonatedBy === "string" ? sessionRecord.impersonatedBy : null,
        }
      : null,
  };
}

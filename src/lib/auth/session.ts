import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { getSession } from "@/lib/server-auth";

type GuardSession = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    role?: "admin" | "user" | null;
    referralCode?: string | null;
  };
  session: {
    id: string;
    impersonatedBy?: string | null;
  };
} | null;

/** Same-origin RPC: reads the better-auth session for the current request. */
export const getCurrentSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<GuardSession> => {
    const session = await getSession(getRequest());
    if (!session?.user) return null;
    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name ?? null,
        role: session.user.role ?? null,
        referralCode: session.user.referralCode ?? null,
      },
      session: {
        id: session.session.id,
        impersonatedBy: session.session.impersonatedBy ?? null,
      },
    };
  },
);

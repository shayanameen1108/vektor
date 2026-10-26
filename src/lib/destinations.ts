/**
 * Where a signed-in visitor should land. `USER_DESTINATIONS` is the allow-list
 * for `?redirect=`; `isAdminConsoleSession` / `homeForSession` are the same
 * admin-vs-impersonation rule used by route guards and `requireAdmin`.
 */
export const USER_DESTINATIONS = [
  "/app",
  "/setup",
  "/documents",
  "/analyze",
  "/billing",
  "/help",
] as const;

export type UserDestination = (typeof USER_DESTINATIONS)[number];

export function userDestination(value: unknown): UserDestination | null {
  return typeof value === "string" && USER_DESTINATIONS.some((path) => path === value)
    ? (value as UserDestination)
    : null;
}

type SessionLike =
  | {
      user?: { role?: "admin" | "user" | null } | null;
      session?: { impersonatedBy?: string | null } | null;
    }
  | null
  | undefined;

/** Admins in their own session live in `/admin`; impersonation stays in `/app`. */
export function isAdminConsoleSession(session: SessionLike): boolean {
  return session?.user?.role === "admin" && !session.session?.impersonatedBy;
}

export function homeForSession(
  session: SessionLike,
  fallback: UserDestination = "/app",
): "/admin" | UserDestination {
  return isAdminConsoleSession(session) ? "/admin" : fallback;
}

import { describe, expect, it } from "vitest";

import { homeForSession, isAdminConsoleSession, userDestination } from "@/lib/destinations";

describe("userDestination", () => {
  it("accepts only the known post-login paths", () => {
    expect(userDestination("/app")).toBe("/app");
    expect(userDestination("/setup")).toBe("/setup");
    expect(userDestination("/documents")).toBe("/documents");
    expect(userDestination("/analyze")).toBe("/analyze");
    expect(userDestination("/billing")).toBe("/billing");
    expect(userDestination("/help")).toBe("/help");
    expect(userDestination("/admin")).toBeNull();
    expect(userDestination("/login")).toBeNull();
    expect(userDestination(undefined)).toBeNull();
  });
});

describe("admin console vs impersonation", () => {
  const admin = { user: { role: "admin" as const }, session: { impersonatedBy: null } };
  const impersonating = {
    user: { role: "admin" as const },
    session: { impersonatedBy: "admin-1" },
  };
  const user = { user: { role: "user" as const }, session: { impersonatedBy: null } };

  it("sends an admin in their own session to /admin", () => {
    expect(isAdminConsoleSession(admin)).toBe(true);
    expect(homeForSession(admin)).toBe("/admin");
  });

  it("keeps impersonation and ordinary users in /app", () => {
    expect(isAdminConsoleSession(impersonating)).toBe(false);
    expect(homeForSession(impersonating)).toBe("/app");
    expect(isAdminConsoleSession(user)).toBe(false);
    expect(homeForSession(user)).toBe("/app");
    expect(isAdminConsoleSession(null)).toBe(false);
    expect(homeForSession(undefined)).toBe("/app");
  });

  it("honours a post-login redirect for everyone except an admin console session", () => {
    expect(homeForSession(user, "/documents")).toBe("/documents");
    expect(homeForSession(impersonating, "/analyze")).toBe("/analyze");
    expect(homeForSession(admin, "/documents")).toBe("/admin");
  });
});

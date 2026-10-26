import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { getCurrentSession } from "@/lib/auth/session";
import { isAdminConsoleSession } from "@/lib/destinations";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const session = await getCurrentSession();
    if (!session?.user) {
      throw redirect({ to: "/login", search: {}, replace: true });
    }
    if (!isAdminConsoleSession(session)) {
      throw redirect({ to: "/app", replace: true });
    }
    return { session };
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}

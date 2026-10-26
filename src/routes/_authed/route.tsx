import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { AppSidebar } from "@/components/app-sidebar";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getCurrentSession } from "@/lib/auth/session";
import { isAdminConsoleSession, userDestination } from "@/lib/destinations";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ location }) => {
    const session = await getCurrentSession();
    const isHelp = location.pathname === "/help";

    if (!session?.user) {
      if (isHelp) return { session: null };
      const destination = userDestination(location.pathname);
      throw redirect({
        to: "/login",
        search: destination ? { redirect: destination } : {},
        replace: true,
      });
    }
    if (isAdminConsoleSession(session)) {
      if (isHelp) throw redirect({ to: "/admin/help" });
      throw redirect({ to: "/admin" });
    }
    return { session };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { session } = Route.useRouteContext();
  if (!session?.user) {
    return <Outlet />;
  }
  return (
    <>
      <ImpersonationBanner />
      <SidebarProvider className="min-h-svh">
        <AppSidebar />
        <SidebarInset className="min-w-0 bg-background pt-(--header-height) pb-24 md:pt-0">
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}

import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOutIcon, Menu } from "lucide-react";
import { toast } from "sonner";

import { VektorMark } from "@/components/vektor-mark";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { asVektorSession, authClient } from "@/lib/auth/auth-client";
import { clearActiveCompany } from "@/hooks/use-active-company";

const NAV_ITEMS = [
  { to: "/admin", label: "Overview", testId: "admin-nav-overview" },
  { to: "/admin/users", label: "Users", testId: "admin-nav-users" },
  { to: "/admin/companies", label: "Companies", testId: "admin-nav-companies" },
  { to: "/admin/eft", label: "EFT", testId: "admin-nav-eft" },
  { to: "/admin/help", label: "Help", testId: "admin-nav-help" },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: rawData } = authClient.useSession();
  const user = asVektorSession(rawData)?.user;

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header data-testid="admin-nav" className="border-b bg-background px-6 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <VektorMark />
            <span className="text-xl font-bold tracking-tight">Vektor Admin</span>
          </div>
          <div className="flex items-center justify-between gap-4 sm:justify-end">
            <nav className="hidden items-center gap-x-6 text-sm lg:flex">
              {NAV_ITEMS.map((item) => {
                const active =
                  item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.testId}
                    to={item.to}
                    data-testid={item.testId}
                    aria-current={active ? "page" : undefined}
                    className={
                      active
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <Sheet>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    data-testid="admin-mobile-menu"
                    aria-label="Open admin navigation"
                    className="lg:hidden !size-11"
                  />
                }
              >
                <Menu aria-hidden="true" />
              </SheetTrigger>
              <SheetContent side="right" className="w-72" data-testid="admin-mobile-sheet">
                <SheetHeader>
                  <SheetTitle>Admin</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 px-4">
                  {NAV_ITEMS.map((item) => {
                    const active =
                      item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to);
                    return (
                      <SheetClose
                        key={`${item.testId}-mobile`}
                        nativeButton={false}
                        render={
                          <Link
                            to={item.to}
                            data-testid={`${item.testId}-mobile`}
                            aria-current={active ? "page" : undefined}
                            className="rounded-sm px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            {item.label}
                          </Link>
                        }
                      />
                    );
                  })}
                </nav>
              </SheetContent>
            </Sheet>
            {user && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-testid="admin-btn-signout"
                aria-label="Sign out"
                title={`Sign out ${user.email}`}
                className="!size-11"
                onClick={async () => {
                  await authClient.signOut();
                  clearActiveCompany();
                  toast.success("Signed out");
                  await navigate({ to: "/login", search: {} });
                }}
              >
                <LogOutIcon aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="p-6 sm:p-8">{children}</main>
    </div>
  );
}

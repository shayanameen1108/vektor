import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BuildingIcon,
  CircleHelpIcon,
  CoinsIcon,
  CreditCardIcon,
  FileTextIcon,
  HouseIcon,
  InfoIcon,
  LogOutIcon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";

import { VektorMark } from "@/components/vektor-mark";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { clearActiveCompany, useActiveCompany } from "@/hooks/use-active-company";
import { asVektorSession, authClient } from "@/lib/auth/auth-client";
import { companiesQuery, creditsQuery } from "@/lib/queries";

const navItems = [
  { to: "/app", label: "Dashboard", testId: "nav-dashboard", icon: HouseIcon },
  { to: "/analyze", label: "Analyze Tender", testId: "nav-analyze", icon: UploadIcon },
  { to: "/documents", label: "Document Vault", testId: "nav-documents", icon: FileTextIcon },
  { to: "/setup", label: "Company Setup", testId: "nav-setup", icon: BuildingIcon },
  { to: "/billing", label: "Billing & Credits", testId: "nav-billing", icon: CreditCardIcon },
  { to: "/help", label: "Help & Guides", testId: "nav-help", icon: CircleHelpIcon },
  { to: "/about", label: "About Vektor", testId: "nav-about", icon: InfoIcon },
] as const;

// SidebarMenuButton already paints idle, hover and active from the sidebar
// tokens; this only adds the high-contrast brand edge on the active item.
const ACTIVE_NAV =
  "font-semibold shadow-[inset_3px_0_0_0_var(--sidebar-primary)] hover:bg-sidebar-accent";

const SECTION_LABEL = "label-caps text-sidebar-foreground/60";

function NavLinks() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.to;
            return (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton
                  isActive={isActive}
                  tooltip={item.label}
                  className={isActive ? ACTIVE_NAV : undefined}
                  render={
                    <Link
                      to={item.to}
                      data-testid={item.testId}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => setOpenMobile(false)}
                    />
                  }
                >
                  <Icon aria-hidden="true" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function CreditsAndCompany() {
  const companiesQueryResult = useQuery(companiesQuery());
  const companies = companiesQueryResult.data ?? [];
  const { company } = useActiveCompany(companies);
  const creditsQueryResult = useQuery({
    ...creditsQuery(company?.id ?? ""),
    enabled: Boolean(company?.id),
  });
  const credits = creditsQueryResult.data?.credits;

  return (
    <>
      <div className="border-t border-sidebar-border px-4 py-3" data-testid="credits-info">
        <div className="mb-1 flex items-center gap-2">
          <CoinsIcon className="h-4 w-4 text-sidebar-primary" aria-hidden="true" />
          <p className={`${SECTION_LABEL} font-semibold`}>Credits</p>
        </div>
        <p className="text-2xl font-bold" data-testid="credits-balance">
          {company ? (credits ?? "—") : 0}
        </p>
        <p className="mt-1 text-xs text-sidebar-foreground/60">tender analyses available</p>
      </div>
      {company ? (
        <div className="border-t border-sidebar-border px-4 py-3" data-testid="company-info">
          <p className={`mb-2 ${SECTION_LABEL} font-semibold`}>Active Company</p>
          <p className="truncate text-sm font-semibold">{company.company_name}</p>
          <p className="text-xs text-sidebar-foreground/60">CIPC: {company.cipc_num}</p>
        </div>
      ) : null}
    </>
  );
}

function UserFooter() {
  const navigate = useNavigate();
  const { data: rawData } = authClient.useSession();
  const user = asVektorSession(rawData)?.user;
  if (!user) return null;
  const initials = (user.name || user.email)
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="px-2 py-1" data-testid="user-info">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className="h-auto w-full justify-start gap-2 px-2 py-1.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              data-testid="user-menu-trigger"
            />
          }
        >
          <Avatar size="sm" className="rounded-sm">
            <AvatarFallback className="rounded-sm bg-sidebar-accent text-[10px] font-bold text-sidebar-accent-foreground">
              {initials || "V"}
            </AvatarFallback>
          </Avatar>
          <span
            className="min-w-0 flex-1 truncate text-left text-xs font-semibold"
            data-testid="user-email"
          >
            {user.email}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="label-caps">Signed in as</DropdownMenuLabel>
            <p className="truncate px-1.5 pb-1 text-xs text-muted-foreground">{user.email}</p>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              data-testid="btn-signout"
              onClick={async () => {
                await authClient.signOut();
                clearActiveCompany();
                toast.success("Signed out");
                await navigate({ to: "/login", search: {} });
              }}
            >
              <LogOutIcon aria-hidden="true" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function AppSidebar() {
  return (
    <>
      <header
        data-testid="mobile-topbar"
        className="fixed inset-x-0 top-[var(--impersonation-banner-height)] z-30 flex h-(--header-height) items-center justify-between border-b border-sidebar-border bg-sidebar px-4 md:hidden"
      >
        <SidebarTrigger
          data-testid="mobile-menu-open"
          aria-label="Open navigation"
          className="-ml-2 !size-11"
        />
        <div className="flex items-center gap-2">
          <VektorMark className="h-6 w-6" />
          <span className="text-lg font-bold tracking-tight">Vektor</span>
        </div>
        <div className="size-10" aria-hidden="true" />
      </header>

      <Sidebar collapsible="offcanvas" data-testid="sidebar">
        <nav aria-label="Vektor navigation" className="flex size-full flex-col">
          <SidebarHeader className="border-b border-sidebar-border p-6">
            <div className="flex items-center gap-2.5">
              <VektorMark />
              <span className="text-xl font-bold tracking-tight">Vektor</span>
            </div>
            <p className={`mt-1 ${SECTION_LABEL} font-semibold`}>SA Tender Compliance</p>
          </SidebarHeader>
          <SidebarContent>
            <NavLinks />
          </SidebarContent>
          <CreditsAndCompany />
          <SidebarFooter className="border-t border-sidebar-border">
            <UserFooter />
          </SidebarFooter>
        </nav>
      </Sidebar>
    </>
  );
}

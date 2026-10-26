import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRightIcon, RefreshCwIcon } from "lucide-react";

import { PageState } from "@/components/page-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminStatsQuery } from "@/lib/queries";

export const Route = createFileRoute("/admin/")({
  component: AdminPage,
});

function AdminPage() {
  const statsQueryResult = useQuery(adminStatsQuery());
  const stats = statsQueryResult.data ?? null;
  const refreshing = statsQueryResult.isFetching;

  if (statsQueryResult.isPending || (statsQueryResult.isError && !statsQueryResult.data)) {
    return (
      <div data-testid="admin-stats-state">
        <PageState
          status={statsQueryResult.isError ? "error" : "loading"}
          message="Could not load admin statistics."
          errorTestId="admin-stats-error"
          retryTestId="admin-stats-retry"
          onRetry={() => void statsQueryResult.refetch()}
        />
      </div>
    );
  }

  const usersTotal = stats?.users?.total ?? 0;
  const adminsTotal = stats?.users?.admins ?? 0;
  const companiesTotal = stats?.companies?.total ?? 0;
  const eftPendingReview = stats?.eft?.pending_review ?? 0;
  const tendersTotal = stats?.tenders?.total ?? 0;
  const docsTotal = stats?.documents?.total ?? 0;

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="overline-label text-muted-foreground">Operations</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight" data-testid="admin-overview-title">
            Admin Console
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Centralised operations overview.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          data-testid="admin-stats-refresh"
          onClick={() => void statsQueryResult.refetch()}
          disabled={refreshing}
        >
          <RefreshCwIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Refresh
        </Button>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card data-testid="admin-stat-users">
          <CardHeader className="pb-2">
            <CardTitle className="overline-label text-muted-foreground">Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{usersTotal}</p>
          </CardContent>
        </Card>
        <Card data-testid="admin-stat-companies">
          <CardHeader className="pb-2">
            <CardTitle className="overline-label text-muted-foreground">Companies</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{companiesTotal}</p>
          </CardContent>
        </Card>
        <Card data-testid="admin-stat-eft">
          <CardHeader className="pb-2">
            <CardTitle className="overline-label text-muted-foreground">EFT Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{eftPendingReview}</p>
            {eftPendingReview > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                awaiting review — reconcile to grant credits
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card data-testid="admin-stat-tenders">
          <CardHeader className="pb-2">
            <CardTitle className="overline-label text-muted-foreground">Tenders analysed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{tendersTotal}</p>
          </CardContent>
        </Card>
        <Card data-testid="admin-stat-docs">
          <CardHeader className="pb-2">
            <CardTitle className="overline-label text-muted-foreground">
              Documents on file
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{docsTotal}</p>
          </CardContent>
        </Card>
        <Card data-testid="admin-stat-admins">
          <CardHeader className="pb-2">
            <CardTitle className="overline-label text-muted-foreground">Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{adminsTotal}</p>
          </CardContent>
        </Card>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Link to="/admin/users" data-testid="admin-quick-users">
          <Card className="rounded-sm border-border shadow-none transition-colors hover:border-primary/40">
            <CardHeader>
              <p className="overline-label text-muted-foreground">User management</p>
              <CardTitle className="flex items-center gap-1.5">
                Manage users <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </CardTitle>
              <CardDescription>Impersonate and troubleshoot accounts.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link to="/admin/companies" data-testid="admin-quick-companies">
          <Card className="rounded-sm border-border shadow-none transition-colors hover:border-primary/40">
            <CardHeader>
              <p className="overline-label text-muted-foreground">Company registry</p>
              <CardTitle className="flex items-center gap-1.5">
                Manage companies <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </CardTitle>
              <CardDescription>Inspect compliance posture at a glance.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link to="/admin/eft" data-testid="admin-quick-eft">
          <Card className="rounded-sm border-border shadow-none transition-colors hover:border-primary/40">
            <CardHeader>
              <p className="overline-label text-muted-foreground">EFT console</p>
              <CardTitle className="flex items-center gap-1.5">
                Review payments <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </CardTitle>
              <CardDescription>Confirm credits and trigger referral rewards.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, BanknoteIcon, FileTextIcon, GiftIcon, InboxIcon } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ActivityItem } from "@/lib/api-client";
import { formatDate } from "@/lib/date";
import { formatRand } from "@/lib/money";
import { EFT_STATUS_LABEL, type EftStatus } from "@/lib/eft";
import { activityQuery } from "@/lib/queries";
import { VERDICT_META } from "@/lib/tender-scoring";

const ACTIVITY_TABS = [
  { key: "all", label: "All", type: null },
  { key: "tender", label: "Tenders", type: "tender" },
  { key: "eft", label: "Payments", type: "eft" },
  { key: "referral_reward", label: "Referrals", type: "referral_reward" },
] as const;

const EMPTY_COPY_BY_TAB: Record<string, string> = {
  all: "Nothing to show yet. Analyze a tender or invite someone to Vektor to get started.",
  tender: "No tender analyses yet. Upload a tender PDF from the dashboard to see it here.",
  eft: "No payments yet. Top up credits or subscribe from the Billing page.",
  referral_reward:
    "No referral rewards yet. Share your referral code from Billing to earn credits.",
};

function timeAgo(iso: string): string {
  const diffS = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffS < 60) return "just now";
  const m = Math.floor(diffS / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return formatDate(iso);
}

function ActivityRowShell({
  testId,
  icon,
  onOpen,
  title,
  badge,
  subtitle,
}: {
  testId: string;
  icon: React.ReactNode;
  onOpen: () => void;
  title: React.ReactNode;
  badge?: React.ReactNode;
  subtitle: React.ReactNode;
}) {
  return (
    <Item
      render={
        <button
          type="button"
          onClick={onOpen}
          data-testid={testId}
          aria-label={typeof title === "string" ? title : "Open activity"}
        />
      }
      className="w-full rounded-none border-0 px-5 py-3.5 hover:bg-accent"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-secondary text-secondary-foreground">
        {icon}
      </div>
      <ItemContent className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <ItemTitle className="truncate">{title}</ItemTitle>
          {badge}
        </div>
        <ItemDescription className="truncate">{subtitle}</ItemDescription>
      </ItemContent>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Item>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const navigate = useNavigate();
  if (item.type === "tender") {
    const verdict = item.verdict || "UNKNOWN";
    return (
      <ActivityRowShell
        testId={`activity-item-tender-${item.id}`}
        icon={<FileTextIcon className="h-4 w-4" aria-hidden="true" />}
        onOpen={() => void navigate({ to: "/analyze", search: { tender: item.id } })}
        title={item.title}
        badge={
          <Badge
            className={`rounded-sm ${(VERDICT_META[verdict] ?? VERDICT_META.UNKNOWN!).badgeClass}`}
          >
            {verdict}
            {typeof item.fit_score === "number" && (
              <span className="opacity-70">· {item.fit_score}%</span>
            )}
          </Badge>
        }
        subtitle={`${item.issuing_entity ? `${item.issuing_entity} · ` : ""}Tender analysis · ${timeAgo(item.created_at)}`}
      />
    );
  }
  if (item.type === "eft") {
    const label = EFT_STATUS_LABEL[item.status as EftStatus] ?? item.status;
    const badgeClass =
      item.status === "confirmed"
        ? "bg-status-success/10 text-status-success"
        : item.status === "rejected"
          ? "bg-destructive/10 text-destructive"
          : "bg-status-warning/10 text-status-warning";
    return (
      <ActivityRowShell
        testId={`activity-item-eft-${item.id}`}
        icon={<BanknoteIcon className="h-4 w-4" aria-hidden="true" />}
        onOpen={() => void navigate({ to: "/billing" })}
        title={`${item.plan_name} · ${formatRand(item.amount)}`}
        badge={<Badge className={`rounded-sm ${badgeClass}`}>{label}</Badge>}
        subtitle={
          <span className="font-mono">
            {item.reference} · EFT payment · {timeAgo(item.created_at)}
          </span>
        }
      />
    );
  }
  return (
    <ActivityRowShell
      testId={`activity-item-referral-${item.id}`}
      icon={<GiftIcon className="h-4 w-4" aria-hidden="true" />}
      onOpen={() => void navigate({ to: "/billing" })}
      title={`Referral reward · +${item.credits_granted} credit${item.credits_granted === 1 ? "" : "s"}`}
      badge={<Badge className="bg-primary/10 text-primary">Earned</Badge>}
      subtitle={`Someone you invited paid for a subscription · ${timeAgo(item.created_at)}`}
    />
  );
}

/**
 * Unified feed of tender analyses, EFT payments and referral rewards with
 * per-type filter tabs. Data comes from /api/dashboard/activity via TanStack
 * Query; each tab refetches so a busy stream never starves another.
 */
export function RecentActivityPanel({ limit = 8 }: { limit?: number }) {
  const [activeTabKey, setActiveTabKey] = useState<string>("all");
  const activeTab = ACTIVITY_TABS.find((t) => t.key === activeTabKey) ?? ACTIVITY_TABS[0];
  const { data, isPending, isError, refetch } = useQuery(
    activityQuery(activeTab.type ?? null, limit),
  );
  const items = data?.items ?? [];

  return (
    <Card className="mb-8" data-testid="recent-activity-panel">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border">
        <CardTitle className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
          Recent Activity
        </CardTitle>
        <span className="overline-label text-muted-foreground">Last {limit}</span>
      </CardHeader>

      <Tabs value={activeTabKey} onValueChange={setActiveTabKey}>
        <TabsList
          aria-label="Activity filter"
          className="flex w-full items-center justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-muted/60 p-2 group-data-horizontal/tabs:h-11"
          data-testid="activity-filter-tabs"
        >
          {ACTIVITY_TABS.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              data-testid={`activity-tab-${tab.key}`}
              className="label-caps flex-none whitespace-nowrap rounded-sm px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground data-active:bg-primary data-active:text-primary-foreground data-active:hover:bg-primary data-active:hover:text-primary-foreground"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <CardContent className="p-0">
        {isPending ? (
          <div className="space-y-3 p-5 sm:p-6" data-testid="activity-loading">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError && !data ? (
          <div className="p-6 sm:p-8" data-testid="activity-error">
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between gap-3">
                Could not load activity.
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  data-testid="activity-retry"
                  onClick={() => void refetch()}
                >
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 sm:p-8" data-testid="activity-empty">
            <Empty className="gap-3 border-none py-2">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <InboxIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>No activity yet</EmptyTitle>
                <EmptyDescription>
                  {EMPTY_COPY_BY_TAB[activeTabKey] ?? EMPTY_COPY_BY_TAB.all}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((it) => (
              <ActivityRow key={`${it.type}-${it.id}`} item={it} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

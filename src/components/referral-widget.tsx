import { useQuery } from "@tanstack/react-query";
import {
  CoinsIcon,
  CopyIcon,
  MailIcon,
  MessageCircleIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { myReferralsQuery } from "@/lib/queries";

const TIER_ROWS = [
  { key: "tc_starter_monthly_v2", label: "Starter" },
  { key: "tc_pro_monthly_v2", label: "Pro" },
  { key: "tc_scale_monthly_v2", label: "Scale" },
];

export function ReferralWidget() {
  const { data: stats, isPending, refetch } = useQuery(myReferralsQuery());

  if (isPending) {
    return (
      <Card className="mb-8" data-testid="referral-widget">
        <CardContent className="space-y-3 p-6 sm:p-8">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Alert variant="destructive" className="mb-8" data-testid="referral-widget-error">
        <AlertDescription className="flex items-center justify-between gap-3">
          Could not load referral stats.
          <Button
            type="button"
            variant="outline"
            size="xs"
            data-testid="referral-retry"
            onClick={() => void refetch()}
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Browser-only by construction: the isPending early return above means this
  // line is never reached during SSR — referrals load through the browser-side
  // api-client fetch seam and no route loader prefetches or dehydrates them.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = `${origin}/signup?ref=${stats.code}`;
  const shareMessage = `I use Vektor for SA tender compliance — CIDB matching, B-BBEE scoring, and expiry alerts in seconds. Sign up with my link: ${shareUrl}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
  const mailtoUrl = `mailto:?subject=${encodeURIComponent("Try Vektor — SA tender compliance in seconds")}&body=${encodeURIComponent(shareMessage)}`;
  const tierRewards = stats.reward_config?.tier_rewards ?? {};

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <Card className="mb-8" data-testid="referral-widget">
      <CardContent className="p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-sm bg-primary/10 border border-primary/30 flex items-center justify-center">
            <UsersIcon size={18} className="text-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="overline-label text-primary">Refer a paid subscriber</p>
            <h2 className="text-lg font-bold text-foreground">Unlock free credits</h2>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mt-2 max-w-2xl">
          Share your link with an SA contractor. When they upgrade to a paid plan, you earn credits
          — no cash rewards, no discounts to them. Just a thank-you for growing the community.
        </p>

        <div
          className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3"
          data-testid="referral-tier-rewards"
        >
          {TIER_ROWS.map((t) => (
            <div
              key={t.key}
              className="rounded-sm border border-border bg-muted px-3 py-2.5 text-center"
              data-testid={`referral-tier-${t.key}`}
            >
              <p className="overline-label text-muted-foreground">{t.label}</p>
              <p className="text-xl font-black text-primary leading-tight mt-0.5">
                +{tierRewards[t.key] ?? 0}
              </p>
              <p className="text-[10px] text-muted-foreground">credits</p>
            </div>
          ))}
        </div>

        <InputGroup className="mt-5 h-auto">
          <InputGroupInput
            id="referral-share-url"
            readOnly
            value={shareUrl}
            aria-label="Referral link"
            className="h-10 font-mono text-xs"
            data-testid="referral-share-url"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              variant="outline"
              size="sm"
              onClick={() => void copy("Link", shareUrl)}
              data-testid="referral-copy-link"
            >
              <CopyIcon aria-hidden="true" />
              Copy
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            render={
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="referral-whatsapp"
                aria-label="Share on WhatsApp"
              />
            }
            size="sm"
            className="bg-whatsapp text-xs font-bold text-whatsapp-foreground hover:bg-whatsapp/90"
          >
            <MessageCircleIcon aria-hidden="true" />
            Share on WhatsApp
          </Button>
          <Button
            render={<a href={mailtoUrl} data-testid="referral-email" aria-label="Email" />}
            size="sm"
            className="text-xs font-bold"
          >
            <MailIcon aria-hidden="true" />
            Email
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-border pt-5 sm:grid-cols-3">
          <div className="text-center">
            <UsersIcon size={16} className="mx-auto mb-1 text-muted-foreground" />
            <p
              className="text-2xl font-black tracking-tight text-foreground"
              data-testid="referral-stat-invited"
            >
              {stats.invited_count}
            </p>
            <p className="overline-label text-muted-foreground mt-0.5">Invited</p>
          </div>
          <div className="text-center">
            <TrendingUpIcon
              size={16}
              className="mx-auto mb-1 text-muted-foreground"
              aria-hidden="true"
            />
            <p
              className="text-2xl font-black tracking-tight text-foreground"
              data-testid="referral-stat-paid"
            >
              {stats.subscribed_count}
            </p>
            <p className="overline-label text-muted-foreground mt-0.5">Subscribed</p>
          </div>
          <div className="text-center">
            <CoinsIcon size={16} className="mx-auto mb-1 text-primary" aria-hidden="true" />
            <p
              className="text-2xl font-black tracking-tight text-primary"
              data-testid="referral-stat-earned"
            >
              {stats.credits_earned}
            </p>
            <p className="overline-label text-muted-foreground mt-0.5">Credits earned</p>
          </div>
        </div>

        <p className="mt-5 text-[11px] text-muted-foreground leading-relaxed">
          Fair-use limit: <strong className="text-foreground">{stats.monthly_remaining}</strong>{" "}
          rewards remaining this month ·{" "}
          <strong className="text-foreground">{stats.lifetime_remaining}</strong> remaining lifetime
          · Rewards apply only after the referee completes their first paid subscription EFT.
        </p>

        {stats.recent && stats.recent.length > 0 && (
          <Collapsible className="mt-4" data-testid="referral-recent-details">
            <CollapsibleTrigger className="cursor-pointer text-xs font-semibold text-foreground">
              Recent invites ({stats.recent.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-3 space-y-1.5">
                {stats.recent.map((r, i) => (
                  <li key={i} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-muted-foreground">{r.referee_email}</span>
                    <span
                      className={`overline-label ${
                        r.status?.includes("paid")
                          ? "text-primary"
                          : r.status === "signed_up"
                            ? "text-muted-foreground"
                            : "text-status-warning"
                      }`}
                    >
                      {r.status?.replace(/_/g, " ")}
                    </span>
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

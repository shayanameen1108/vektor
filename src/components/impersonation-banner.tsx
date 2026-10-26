import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { asVektorSession, authClient } from "@/lib/auth/auth-client";
import { toast } from "sonner";

export function ImpersonationBanner() {
  const { data } = authClient.useSession();
  const session = asVektorSession(data);
  if (!session?.user || !session.session) return null;
  // Only show when an admin is wearing a user hat.
  if (!session.session.impersonatedBy) return null;

  const stop = async () => {
    try {
      const result = await authClient.admin.stopImpersonating();
      if (result.error) {
        toast.error(result.error.message || "Could not exit impersonation");
        return;
      }
      // Full reload so every surface rebuilds against the restored session cookie.
      window.location.assign("/admin");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not exit impersonation");
    }
  };

  return (
    <Alert
      data-impersonation
      data-testid="impersonation-banner"
      className="fixed inset-x-0 top-0 z-[60] flex min-h-10 items-center rounded-none border-0 bg-status-warning px-4 py-2 text-sm font-semibold text-status-warning-foreground"
    >
      <AlertDescription className="flex min-h-6 w-full items-center justify-between gap-3 text-status-warning-foreground">
        <span className="min-w-0 truncate">Impersonating {session.user.email} — admin view</span>
        <Button
          type="button"
          data-testid="impersonation-exit"
          onClick={() => void stop()}
          size="xs"
          className="rounded-sm bg-background tight-caps text-foreground hover:bg-accent"
        >
          Exit impersonation
        </Button>
      </AlertDescription>
    </Alert>
  );
}

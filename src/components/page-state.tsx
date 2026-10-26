import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";

export function PageState({
  status,
  message,
  onRetry,
  errorTestId,
  retryTestId,
}: {
  status: "loading" | "error";
  message?: string;
  onRetry?: () => void;
  errorTestId?: string;
  retryTestId?: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-background p-8">
      {status === "error" ? (
        <Empty className="max-w-md border-none" data-testid={errorTestId} role="alert">
          <EmptyHeader>
            <EmptyTitle className="text-xl font-bold">Could not load</EmptyTitle>
            <EmptyDescription>{message ?? "Something went wrong. Try again."}</EmptyDescription>
          </EmptyHeader>
          {onRetry ? (
            <EmptyContent>
              <Button data-testid={retryTestId} variant="outline" onClick={onRetry}>
                Try again
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <div className="flex flex-col items-center gap-3" aria-busy="true">
          <Spinner className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

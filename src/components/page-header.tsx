import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  overline,
  title,
  titleTestId,
  description,
  actions,
  children,
  testId = "page-header",
  sticky = true,
  className,
}: {
  overline?: string;
  title: ReactNode;
  titleTestId?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  testId?: string;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <header
      data-testid={testId}
      className={cn(
        "border-b border-border bg-card px-6 py-6 text-card-foreground sm:px-8",
        sticky &&
          "sticky top-[calc(var(--header-height)+var(--impersonation-banner-height))] z-10 md:top-(--impersonation-banner-height)",
        className,
      )}
    >
      <div
        className={
          actions ? "flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between" : undefined
        }
      >
        <div className="min-w-0">
          {overline ? (
            <p className="overline-label mb-1 text-muted-foreground">{overline}</p>
          ) : null}
          <h1
            className="line-clamp-2 text-2xl font-bold tracking-tight break-words sm:text-3xl md:text-4xl"
            data-testid={titleTestId}
          >
            {title}
          </h1>
          {description ? (
            <div className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </header>
  );
}

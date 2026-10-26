import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";

import { VektorMark } from "@/components/vektor-mark";

export function AuthShell({
  title,
  subtitle,
  eyebrow,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const [year] = useState(() => new Date().getFullYear());
  return (
    <main className="flex min-h-svh overflow-x-hidden bg-background text-foreground">
      <div className="hidden w-1/2 flex-col justify-between border-r border-border bg-card p-12 lg:flex">
        <Link to="/" data-testid="auth-brand-home" className="flex items-center gap-2">
          <VektorMark className="h-8 w-8" />
          <span className="text-2xl font-bold tracking-tight">Vektor</span>
        </Link>

        <div className="max-w-md space-y-4">
          <p className="text-sm font-medium text-primary">SA tender compliance</p>
          <h2 className="text-2xl font-semibold tracking-tight">
            Never lose a bid on a technicality again.
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            CIDB matching, B-BBEE scoring, and expiry alerts for SA public tenders in seconds, not
            weeks.
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm text-foreground">
            <li>5 free tender analyses when the company profile is created</li>
            <li>SBD 4 and SBD 6.1 filled from the company profile</li>
            <li>Email at 30, 7, and 0 days before a document expires</li>
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          © {year} Vektor · Built for South African contractors ·{" "}
          <Link
            to="/about"
            data-testid="auth-about-link"
            className="text-muted-foreground underline underline-offset-2 transition-colors hover:text-primary"
          >
            About Vektor
          </Link>
        </p>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-6 py-12">
        <div className="relative w-full max-w-sm">
          <div className="mt-2 mb-10 flex items-center justify-center gap-3 lg:hidden">
            <VektorMark className="h-10 w-10" />
            <span className="text-3xl font-bold tracking-tight">Vektor</span>
          </div>
          {eyebrow && (
            <p
              data-testid="auth-eyebrow"
              className="mb-6 border-b border-border pb-6 text-sm leading-relaxed text-muted-foreground"
            >
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </main>
  );
}

import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

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
  return (
    <main className="flex min-h-svh overflow-x-hidden bg-background text-foreground">
      <div className="relative hidden w-1/2 flex-col justify-between border-r border-border p-12 lg:flex">
        <div aria-hidden="true" className="blueprint-grid pointer-events-none absolute inset-0" />
        <div aria-hidden="true" className="brand-glow pointer-events-none absolute inset-0" />
        <Link to="/" data-testid="auth-brand-home" className="relative flex items-center gap-2.5">
          <VektorMark className="h-8 w-8" />
          <span className="text-2xl font-bold tracking-tight">Vektor</span>
        </Link>

        <div className="relative max-w-md space-y-6">
          <p className="inline-flex items-center gap-2 overline-label text-primary">
            <span className="inline-block h-px w-6 bg-primary" />
            SA Tender Compliance
          </p>
          <h2 className="text-4xl leading-[1.05] font-black tracking-tight xl:text-5xl">
            Never lose a bid on a <span className="text-primary">technicality</span> again.
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            CIDB matching, B-BBEE scoring, and expiry alerts for SA public tenders in seconds, not
            weeks.
          </p>
          <ul className="space-y-2.5 pt-2 text-sm text-foreground">
            <li className="flex items-start gap-2.5">
              <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
              <span>5 free tender analyses on signup</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
              <span>Auto-fill SBD 4 and SBD 6.1 forms</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
              <span>Email alerts 30 / 7 / 0 days before compliance expires</span>
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-muted-foreground">
          © {new Date().getFullYear()} Vektor · Built for South African contractors ·{" "}
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
          <h1 className="text-3xl font-black tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </main>
  );
}

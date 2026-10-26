import { Link } from "@tanstack/react-router";

export function PublicFooter({ testIdPrefix }: { testIdPrefix: string }) {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground md:flex-row">
        <span>© {new Date().getFullYear()} Vektor · SA Tender Compliance</span>
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-5">
          <Link
            to="/about"
            data-testid={`${testIdPrefix}-footer-about`}
            className="hover:text-foreground"
          >
            About
          </Link>
          <Link
            to="/help"
            data-testid={`${testIdPrefix}-footer-help`}
            className="hover:text-foreground"
          >
            Help
          </Link>
          <Link
            to="/terms"
            data-testid={`${testIdPrefix}-footer-terms`}
            className="hover:text-foreground"
          >
            Terms
          </Link>
          <Link
            to="/privacy"
            data-testid={`${testIdPrefix}-footer-privacy`}
            className="hover:text-foreground"
          >
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}

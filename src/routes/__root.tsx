import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { createRootRouteWithContext, HeadContent, Link, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { HelpFab } from "@/components/help-fab";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import styles from "@/styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Vektor — SA Tender Compliance" },
      {
        name: "description",
        content: "Automated South African tender compliance & bid intelligence.",
      },
      { name: "theme-color", content: "#09090b" },
      { property: "og:title", content: "Vektor — SA Tender Compliance" },
      {
        property: "og:description",
        content:
          "Never lose a bid on a technicality again. CIDB matching, B-BBEE scoring, SBD forms, expiry alerts.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: styles },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
  errorComponent: RootError,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en-ZA" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        <TooltipProvider>
          {children}
          <HelpFab />
          <Toaster position="bottom-right" offset={{ bottom: 88, right: 24 }} />
        </TooltipProvider>
        {import.meta.env.DEV ? (
          <TanStackDevtools
            config={{ position: "bottom-right" }}
            plugins={[
              {
                name: "TanStack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        ) : null}
        <Scripts />
      </body>
    </html>
  );
}

function RootError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <Empty className="max-w-md border-none" role="alert">
        <EmptyHeader>
          <h1 className="font-heading text-xl font-bold tracking-tight">Something went wrong</h1>
          <EmptyDescription>{error.message || "Try again."}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button data-testid="root-error-retry" variant="outline" onClick={reset}>
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}

function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <Empty className="max-w-md border-none">
        <EmptyHeader>
          <h1 className="font-heading text-xl font-bold tracking-tight">Page not found</h1>
          <EmptyDescription>That address is not a Vektor page.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link to="/" data-testid="not-found-home" />} variant="outline">
            Return home
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}

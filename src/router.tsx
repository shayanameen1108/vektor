import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
// TanStack Start 1.168.46 selects Router 1.170.29; the independent SSR-query
// integration currently resolves to 1.167.1. Keep the canonical integration.
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // App data (companies, documents, tenders, credits) only changes
        // through user actions in this app, so aggressive background refetching
        // just churns renders (and starves axe scans in e2e).
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    scrollRestorationBehavior: "auto",
  });

  setupRouterSsrQueryIntegration({ router, queryClient });
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

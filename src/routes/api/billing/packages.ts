import { createFileRoute } from "@tanstack/react-router";

import { CATALOG, toPackageApi } from "@/lib/billing-catalog";

export const Route = createFileRoute("/api/billing/packages")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({ packages: CATALOG.map(toPackageApi) });
      },
    },
  },
});

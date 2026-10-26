import { createFileRoute } from "@tanstack/react-router";
import { getBankDetails } from "@/lib/eft";
import { runtimeEnv } from "@/lib/runtime-env";
import { requireUser } from "@/lib/server-auth";

export const Route = createFileRoute("/api/eft/bank-details")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await requireUser(request);
        if (session instanceof Response) return session;
        const details = getBankDetails(runtimeEnv);
        return Response.json(details);
      },
    },
  },
});

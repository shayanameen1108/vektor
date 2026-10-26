import { createFileRoute } from "@tanstack/react-router";

import { isLocal, localMail } from "@/lib/ports";
import { runtimeEnv } from "@/lib/runtime-env";

/**
 * The local mailbox, newest first, for e2e specs to read what was sent.
 * `?to=` narrows it to one recipient. Outside ENVIRONMENT="local" the route
 * does not exist.
 */
export const Route = createFileRoute("/api/dev/mail")({
  server: {
    handlers: {
      GET: ({ request }) => {
        if (!isLocal(runtimeEnv)) return Response.json({ detail: "Not found" }, { status: 404 });
        const to = new URL(request.url).searchParams.get("to")?.trim().toLowerCase();
        return Response.json(
          to ? localMail.filter((email) => email.to.toLowerCase() === to) : localMail,
        );
      },
    },
  },
});

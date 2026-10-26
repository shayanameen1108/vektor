import { createFileRoute } from "@tanstack/react-router";

import { listCouncilsPublic } from "@/lib/bargaining-councils";

export const Route = createFileRoute("/api/reference/bargaining-councils")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({ councils: listCouncilsPublic() });
      },
    },
  },
});

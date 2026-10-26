import { createFileRoute } from "@tanstack/react-router";

import { AuthedHelpPage, PublicHelpPage } from "@/components/help-page";

export const Route = createFileRoute("/_authed/help")({
  component: HelpRoute,
});

function HelpRoute() {
  const { session } = Route.useRouteContext();
  if (!session?.user) {
    return <PublicHelpPage />;
  }
  return <AuthedHelpPage />;
}

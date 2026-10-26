import { createFileRoute } from "@tanstack/react-router";

import { AdminHelpPage } from "@/components/help-page";

export const Route = createFileRoute("/admin/help")({
  component: AdminHelpPage,
});

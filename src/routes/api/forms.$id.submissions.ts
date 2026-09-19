import { createFileRoute } from "@tanstack/react-router";
import { handleInbox } from "~/server/submissions";
import { run } from "~/server/run";

export const Route = createFileRoute("/api/forms/$id/submissions")({
  server: {
    handlers: {
      GET: ({ request, params }) => run(() => handleInbox(request, params.id)),
    },
  },
});

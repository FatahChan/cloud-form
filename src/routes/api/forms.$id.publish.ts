import { createFileRoute } from "@tanstack/react-router";
import { handlePublish } from "~/server/forms";
import { run } from "~/server/run";

export const Route = createFileRoute("/api/forms/$id/publish")({
  server: {
    handlers: {
      POST: ({ request, params }) => run(() => handlePublish(request, params.id)),
    },
  },
});

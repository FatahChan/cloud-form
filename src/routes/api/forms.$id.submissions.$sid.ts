import { createFileRoute } from "@tanstack/react-router";
import { handleSubmission } from "~/server/submissions";
import { run } from "~/server/run";

export const Route = createFileRoute("/api/forms/$id/submissions/$sid")({
  server: {
    handlers: {
      GET: ({ request, params }) => run(() => handleSubmission(request, params.id, params.sid)),
    },
  },
});

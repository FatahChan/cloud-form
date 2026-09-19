import { createFileRoute } from "@tanstack/react-router";
import { handlePublicSubmit } from "~/server/submissions";
import { run } from "~/server/run";

export const Route = createFileRoute("/api/public/forms/$slug/submit")({
  server: {
    handlers: {
      POST: ({ request, params }) => run(() => handlePublicSubmit(request, params.slug)),
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { handlePublicUpload } from "~/server/submissions";
import { run } from "~/server/run";

export const Route = createFileRoute("/api/public/forms/$slug/files")({
  server: {
    handlers: {
      POST: ({ request, params }) => run(() => handlePublicUpload(request, params.slug)),
    },
  },
});

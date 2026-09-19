import { createFileRoute } from "@tanstack/react-router";
import { handleDownload } from "~/server/submissions";
import { run } from "~/server/run";

export const Route = createFileRoute("/api/forms/$id/submissions/$sid/files/$fileId")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        run(() => handleDownload(request, params.id, params.sid, params.fileId)),
    },
  },
});

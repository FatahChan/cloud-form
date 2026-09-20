import { createFileRoute } from "@tanstack/react-router";
import { authMiddleware } from "~/server/middleware";
import { run } from "~/server/serve";
import * as submissions from "~/server/services/submissions";

export const Route = createFileRoute("/api/forms/$id/submissions/$sid/files/$fileId")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: ({ params }) =>
        run(async () => {
          const file = await submissions.downloadSubmissionFile(params.id, params.sid, params.fileId);
          return new Response(file.body, {
            headers: {
              "Content-Type": file.contentType,
              "Content-Disposition": `attachment; filename="${file.filename.replace(/"/g, "")}"`,
            },
          });
        }),
    },
  },
});

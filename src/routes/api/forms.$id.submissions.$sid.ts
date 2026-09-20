import { createFileRoute } from "@tanstack/react-router";
import { authMiddleware } from "~/server/middleware";
import { serve } from "~/server/serve";
import * as submissions from "~/server/services/submissions";

export const Route = createFileRoute("/api/forms/$id/submissions/$sid")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: ({ params }) => serve(() => submissions.getSubmission(params.id, params.sid)),
    },
  },
});

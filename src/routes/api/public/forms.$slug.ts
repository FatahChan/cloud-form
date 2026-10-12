import { createFileRoute } from "@tanstack/react-router";
import { rateLimit } from "~/server/middleware";
import { serve } from "~/server/serve";
import * as submissions from "~/server/services/submissions";

export const Route = createFileRoute("/api/public/forms/$slug")({
  server: {
    middleware: [rateLimit("PUBLIC_LIMITER")],
    handlers: {
      GET: ({ params }) => serve(() => submissions.getPublicForm(params.slug)),
    },
  },
});

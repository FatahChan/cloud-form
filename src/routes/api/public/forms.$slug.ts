import { createFileRoute } from "@tanstack/react-router";
import { serve } from "~/server/serve";
import * as submissions from "~/server/services/submissions";

export const Route = createFileRoute("/api/public/forms/$slug")({
  server: {
    handlers: {
      GET: ({ params }) => serve(() => submissions.getPublicForm(params.slug)),
    },
  },
});

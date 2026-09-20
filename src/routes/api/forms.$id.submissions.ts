import { createFileRoute } from "@tanstack/react-router";
import { authMiddleware } from "~/server/middleware";
import { serve } from "~/server/serve";
import * as submissions from "~/server/services/submissions";

export const Route = createFileRoute("/api/forms/$id/submissions")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: ({ request, params }) =>
        serve(() => {
          const url = new URL(request.url);
          return submissions.listInbox(params.id, {
            slug: url.searchParams.get("slug"),
            q: url.searchParams.get("q"),
            cursor: url.searchParams.get("cursor"),
            limit: url.searchParams.get("limit"),
          });
        }),
    },
  },
});

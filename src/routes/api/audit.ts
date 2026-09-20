import { createFileRoute } from "@tanstack/react-router";
import { authMiddleware } from "~/server/middleware";
import { serve } from "~/server/serve";
import * as auth from "~/server/services/auth";

export const Route = createFileRoute("/api/audit")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: ({ request }) =>
        serve(() => {
          const limit = Math.min(50, Number(new URL(request.url).searchParams.get("limit") ?? 50) || 50);
          return auth.listAudit(limit);
        }),
    },
  },
});

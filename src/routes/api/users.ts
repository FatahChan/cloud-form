import { createFileRoute } from "@tanstack/react-router";
import { authMiddleware } from "~/server/middleware";
import { serve } from "~/server/serve";
import * as auth from "~/server/services/auth";

export const Route = createFileRoute("/api/users")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: () => serve(() => auth.listUsers()),
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { authed } from "~/server/context";
import { authMiddleware } from "~/server/middleware";
import { serve } from "~/server/serve";
import * as auth from "~/server/services/auth";

export const Route = createFileRoute("/api/me")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: ({ context }) => serve(() => auth.me(authed(context).user)),
    },
  },
});

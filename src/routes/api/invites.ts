import { createFileRoute } from "@tanstack/react-router";
import { authed } from "~/server/context";
import { authMiddleware } from "~/server/middleware";
import { serve } from "~/server/serve";
import * as auth from "~/server/services/auth";

export const Route = createFileRoute("/api/invites")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: ({ context }) => serve(() => auth.createInvite(authed(context).user)),
    },
  },
});

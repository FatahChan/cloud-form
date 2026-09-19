import { createFileRoute } from "@tanstack/react-router";
import { handleInvite } from "~/server/auth";
import { run } from "~/server/run";

export const Route = createFileRoute("/api/invites")({
  server: {
    handlers: {
      POST: ({ request }) => run(() => handleInvite(request)),
    },
  },
});

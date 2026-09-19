import { createFileRoute } from "@tanstack/react-router";
import { handleJoin } from "~/server/auth";
import { run } from "~/server/run";

export const Route = createFileRoute("/api/join")({
  server: {
    handlers: {
      POST: ({ request }) => run(() => handleJoin(request)),
    },
  },
});

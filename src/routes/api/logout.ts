import { createFileRoute } from "@tanstack/react-router";
import { handleLogout } from "~/server/auth";
import { run } from "~/server/run";

export const Route = createFileRoute("/api/logout")({
  server: {
    handlers: {
      POST: ({ request }) => run(() => handleLogout(request)),
    },
  },
});

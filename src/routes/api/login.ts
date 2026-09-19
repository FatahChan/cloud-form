import { createFileRoute } from "@tanstack/react-router";
import { handleLogin } from "~/server/auth";
import { run } from "~/server/run";

export const Route = createFileRoute("/api/login")({
  server: {
    handlers: {
      POST: ({ request }) => run(() => handleLogin(request)),
    },
  },
});

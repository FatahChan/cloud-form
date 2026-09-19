import { createFileRoute } from "@tanstack/react-router";
import { handleMe } from "~/server/auth";
import { run } from "~/server/run";

export const Route = createFileRoute("/api/me")({
  server: {
    handlers: {
      GET: ({ request }) => run(() => handleMe(request)),
    },
  },
});

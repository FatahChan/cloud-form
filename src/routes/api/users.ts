import { createFileRoute } from "@tanstack/react-router";
import { handleUsers } from "~/server/auth";
import { run } from "~/server/run";

export const Route = createFileRoute("/api/users")({
  server: {
    handlers: {
      GET: ({ request }) => run(() => handleUsers(request)),
    },
  },
});

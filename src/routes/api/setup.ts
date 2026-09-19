import { createFileRoute } from "@tanstack/react-router";
import { handleSetup } from "~/server/auth";
import { run } from "~/server/run";

export const Route = createFileRoute("/api/setup")({
  server: {
    handlers: {
      POST: ({ request }) => run(() => handleSetup(request)),
    },
  },
});

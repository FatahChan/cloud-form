import { createFileRoute } from "@tanstack/react-router";
import { handleAudit } from "~/server/auth";
import { run } from "~/server/run";

export const Route = createFileRoute("/api/audit")({
  server: {
    handlers: {
      GET: ({ request }) => run(() => handleAudit(request)),
    },
  },
});

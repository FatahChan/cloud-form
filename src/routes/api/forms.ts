import { createFileRoute } from "@tanstack/react-router";
import { handleListForms } from "~/server/forms";
import { run } from "~/server/run";

export const Route = createFileRoute("/api/forms")({
  server: {
    handlers: {
      GET: ({ request }) => run(() => handleListForms(request)),
      POST: ({ request }) => run(() => handleListForms(request)),
    },
  },
});

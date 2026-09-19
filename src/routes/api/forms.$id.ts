import { createFileRoute } from "@tanstack/react-router";
import { handleForm } from "~/server/forms";
import { run } from "~/server/run";

export const Route = createFileRoute("/api/forms/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) => run(() => handleForm(request, params.id)),
      PUT: ({ request, params }) => run(() => handleForm(request, params.id)),
      DELETE: ({ request, params }) => run(() => handleForm(request, params.id)),
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { handlePublicForm } from "~/server/submissions";
import { run } from "~/server/run";

export const Route = createFileRoute("/api/public/forms/$slug")({
  server: {
    handlers: {
      GET: ({ params }) => run(() => handlePublicForm(params.slug)),
    },
  },
});

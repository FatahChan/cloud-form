import { createFileRoute } from "@tanstack/react-router";
import { readJson, serve } from "~/server/serve";
import * as submissions from "~/server/services/submissions";

export const Route = createFileRoute("/api/public/forms/$slug/submit")({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        serve(async () => {
          const body = await readJson<{ answers?: unknown }>(request);
          return submissions.submitPublic(params.slug, body?.answers);
        }),
    },
  },
});

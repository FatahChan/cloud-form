import { createFileRoute } from "@tanstack/react-router";
import { rateLimit } from "~/server/middleware";
import { readJson, serve } from "~/server/serve";
import * as submissions from "~/server/services/submissions";

export const Route = createFileRoute("/api/public/forms/$slug/submit")({
  server: {
    middleware: [rateLimit("PUBLIC_LIMITER")],
    handlers: {
      POST: async ({ request, params }) =>
        serve(async () => {
          const body = await readJson<{ answers?: unknown }>(request);
          return submissions.submitPublic(params.slug, body?.answers);
        }),
    },
  },
});

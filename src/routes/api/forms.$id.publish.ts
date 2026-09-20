import { createFileRoute } from "@tanstack/react-router";
import { authed } from "~/server/context";
import { authMiddleware } from "~/server/middleware";
import { readJson, serve } from "~/server/serve";
import * as forms from "~/server/services/forms";

export const Route = createFileRoute("/api/forms/$id/publish")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ request, params, context }) =>
        serve(async () => {
          const body = await readJson<{ published?: boolean }>(request);
          return forms.publishForm(authed(context).user, params.id, !!body?.published);
        }),
    },
  },
});

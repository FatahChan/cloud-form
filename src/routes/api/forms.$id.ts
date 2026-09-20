import { createFileRoute } from "@tanstack/react-router";
import { authed } from "~/server/context";
import { authMiddleware } from "~/server/middleware";
import { readJson, serve } from "~/server/serve";
import * as forms from "~/server/services/forms";

export const Route = createFileRoute("/api/forms/$id")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: ({ params }) => serve(() => forms.getForm(params.id)),
      PUT: async ({ request, params, context }) =>
        serve(async () => {
          const body = await readJson<{ title?: string; schema?: unknown }>(request);
          return forms.updateForm(authed(context).user, params.id, body ?? {});
        }),
      DELETE: ({ params, context }) => serve(() => forms.deleteForm(authed(context).user, params.id)),
    },
  },
});

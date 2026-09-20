import { createFileRoute } from "@tanstack/react-router";
import { authed } from "~/server/context";
import { authMiddleware } from "~/server/middleware";
import { readJson, serve } from "~/server/serve";
import * as forms from "~/server/services/forms";

export const Route = createFileRoute("/api/forms")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: () => serve(() => forms.listForms()),
      POST: async ({ request, context }) =>
        serve(async () => {
          const body = await readJson<{ title?: string }>(request);
          return forms.createForm(authed(context).user, body?.title);
        }),
    },
  },
});

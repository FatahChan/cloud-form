import { createFileRoute } from "@tanstack/react-router";
import { json, withCookies } from "~/server/http";
import { run } from "~/server/serve";
import * as auth from "~/server/services/auth";

export const Route = createFileRoute("/api/logout")({
  server: {
    handlers: {
      POST: ({ request }) =>
        run(async () => {
          const { cookie } = await auth.logout(request);
          return withCookies(json({ ok: true }), [cookie]);
        }),
    },
  },
});

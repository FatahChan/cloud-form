import { createFileRoute } from "@tanstack/react-router";
import { json, withCookies } from "~/server/http";
import { readJson, run } from "~/server/serve";
import * as auth from "~/server/services/auth";

export const Route = createFileRoute("/api/login")({
  server: {
    handlers: {
      POST: ({ request }) =>
        run(async () => {
          const body = await readJson<{ email?: string; password?: string }>(request);
          const { cookie } = await auth.login(body ?? {}, request);
          return withCookies(json({ ok: true }), [cookie]);
        }),
    },
  },
});

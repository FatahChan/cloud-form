import { createFileRoute } from "@tanstack/react-router";
import { json, withCookies } from "~/server/http";
import { readJson, run } from "~/server/serve";
import * as auth from "~/server/services/auth";

export const Route = createFileRoute("/api/join")({
  server: {
    handlers: {
      POST: ({ request }) =>
        run(async () => {
          const body = await readJson<{
            token?: string;
            name?: string;
            password?: string;
            email?: string;
          }>(request);
          const { cookie } = await auth.join(body ?? {}, request);
          return withCookies(json({ ok: true }), [cookie]);
        }),
    },
  },
});

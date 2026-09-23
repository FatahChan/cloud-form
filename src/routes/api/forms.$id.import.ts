import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authed } from "~/server/context";
import { authMiddleware } from "~/server/middleware";
import { json } from "~/server/http";
import { readJson, run } from "~/server/serve";
import * as submissions from "~/server/services/submissions";

const bodySchema = z.object({
  mapping: z.record(z.union([z.string(), z.null()])),
  rows: z.array(z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))),
});

function stringifyRows(rows: z.infer<typeof bodySchema>["rows"]): Record<string, string>[] {
  return rows.map((row) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = v == null ? "" : String(v);
    }
    return out;
  });
}

export const Route = createFileRoute("/api/forms/$id/import")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ request, params, context }) =>
        run(async () => {
          const raw = await readJson<unknown>(request);
          const parsed = bodySchema.safeParse(raw);
          if (!parsed.success) return json({ error: "Invalid import payload" }, 400);
          const result = await submissions.importSubmissions(
            authed(context).user,
            params.id,
            parsed.data.mapping,
            stringifyRows(parsed.data.rows),
          );
          if (!result.ok) {
            return json(
              {
                error: result.analysis.blockers[0]?.message ?? "Import is not ready",
                blockers: result.analysis.blockers,
                warnings: result.analysis.warnings,
              },
              400,
            );
          }
          return json(result);
        }),
    },
  },
});

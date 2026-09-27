import { createFileRoute } from "@tanstack/react-router";
import { HttpError } from "~/server/errors";
import { rateLimit } from "~/server/middleware";
import { serve } from "~/server/serve";
import * as submissions from "~/server/services/submissions";

export const Route = createFileRoute("/api/public/forms/$slug/files")({
  server: {
    middleware: [rateLimit("PUBLIC_LIMITER")],
    handlers: {
      POST: async ({ request, params }) =>
        serve(async () => {
          const form = await request.formData();
          const file = form.get("file");
          const questionId = String(form.get("questionId") ?? "");
          if (!(file instanceof File)) throw new HttpError("file required", 400);
          return submissions.uploadPublicFile(params.slug, file, questionId);
        }),
    },
  },
});

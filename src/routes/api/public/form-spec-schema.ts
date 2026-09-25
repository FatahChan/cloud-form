import { createFileRoute } from "@tanstack/react-router";
import { serve } from "~/server/serve";
import { formSpecJsonSchema } from "~/shared/form-spec";

export const Route = createFileRoute("/api/public/form-spec-schema")({
  server: {
    handlers: {
      GET: () => serve(() => formSpecJsonSchema()),
    },
  },
});

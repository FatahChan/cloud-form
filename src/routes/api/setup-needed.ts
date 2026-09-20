import { createFileRoute } from "@tanstack/react-router";
import { serve } from "~/server/serve";
import * as auth from "~/server/services/auth";

export const Route = createFileRoute("/api/setup-needed")({
  server: {
    handlers: {
      GET: () => serve(() => auth.setupNeeded()),
    },
  },
});

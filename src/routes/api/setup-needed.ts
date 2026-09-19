import { createFileRoute } from "@tanstack/react-router";
import { handleSetupNeeded } from "~/server/auth";
import { run } from "~/server/run";

export const Route = createFileRoute("/api/setup-needed")({
  server: {
    handlers: {
      GET: () => run(handleSetupNeeded),
    },
  },
});

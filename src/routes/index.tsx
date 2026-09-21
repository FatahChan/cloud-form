import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/pages/landing";

export const Route = createFileRoute("/")({
  // Marketing copy is indexed on GitHub Pages; Worker landings are duplicates.
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  component: () => <LandingPage showAdmin />,
});

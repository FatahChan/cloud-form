import { createFileRoute } from "@tanstack/react-router";
import { ExamplePage } from "@/pages/example-player";

export const Route = createFileRoute("/examples/$slug")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  component: ExampleRoute,
});

function ExampleRoute() {
  const { slug } = Route.useParams();
  return <ExamplePage slug={slug} showAdmin />;
}

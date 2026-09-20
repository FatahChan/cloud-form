import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { ThemeProvider } from "@/components/theme-provider";
import { ExamplePage } from "@/pages/example-player";
import { LandingPage } from "@/pages/landing";

const rootRoute = createRootRoute({
  component: () => (
    <ThemeProvider>
      <Outlet />
    </ThemeProvider>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LandingPage,
});

const exampleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/examples/$slug",
  component: function Example() {
    const { slug } = exampleRoute.useParams();
    return <ExamplePage slug={slug} />;
  },
});

const routeTree = rootRoute.addChildren([indexRoute, exampleRoute]);
const basepath = import.meta.env.BASE_URL.replace(/\/$/, "");

const router = createRouter({
  routeTree,
  scrollRestoration: true,
  ...(basepath ? { basepath } : {}),
});

export function App() {
  return <RouterProvider router={router as never} />;
}

import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { api } from "~/lib/api";
import type { SessionUser } from "~/server/session";
import { CloudFormLogoLink } from "@/components/logo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const open = pathname === "/admin/login" || pathname === "/admin/setup";

  useEffect(() => {
    let gone = false;
    (async () => {
      const { needed } = await api<{ needed: boolean }>("/api/setup-needed");
      const me = await fetch("/api/me", { credentials: "same-origin" });
      if (gone) return;
      if (me.ok) {
        const data = (await me.json()) as { user: SessionUser };
        setUser(data.user);
        if (open) await navigate({ to: "/admin" });
      } else {
        setUser(null);
        if (!open) await navigate({ to: needed ? "/admin/setup" : "/admin/login" });
      }
      setReady(true);
    })();
    return () => {
      gone = true;
    };
  }, [pathname, open, navigate]);

  if (!ready && !open) return null;
  if (open) return <Outlet />;
  if (!user) return null;

  const nav = [
    { to: "/admin" as const, label: "Forms", exact: true, on: pathname === "/admin" },
    {
      to: "/admin/templates" as const,
      label: "Templates",
      exact: false,
      on: pathname.startsWith("/admin/templates"),
    },
    { to: "/admin/team" as const, label: "Team", exact: false, on: pathname.startsWith("/admin/team") },
    { to: "/admin/audit" as const, label: "Audit", exact: false, on: pathname.startsWith("/admin/audit") },
  ];

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-1 px-4">
          <Link to="/admin" className="mr-3 flex items-center text-foreground hover:text-foreground">
            <CloudFormLogoLink />
          </Link>
          {nav.map((item) => (
            <Button
              key={item.to}
              variant="ghost"
              size="sm"
              asChild
              className={cn(item.on && "bg-muted")}
            >
              <Link to={item.to} activeOptions={item.exact ? { exact: true } : undefined}>
                {item.label}
              </Link>
            </Button>
          ))}
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.name}</span>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={async () => {
                await api("/api/logout", { method: "POST" });
                await navigate({ to: "/admin/login" });
              }}
            >
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}

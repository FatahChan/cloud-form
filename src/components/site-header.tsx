import { Link } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function SiteHeader({ showAdmin = false }: { showAdmin?: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
        <Link to="/" className="font-heading text-sm font-medium tracking-tight">
          Cloud Form
        </Link>
        <Link to="/" hash="examples" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
          Examples
        </Link>
        <a
          href="https://github.com/FatahChan/cloud-form"
          className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
        >
          GitHub
        </a>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {showAdmin ? (
            <Button size="sm" asChild>
              <Link to="/admin">Admin</Link>
            </Button>
          ) : (
            <Button size="sm" asChild>
              <a href="https://github.com/FatahChan/cloud-form">View repo</a>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

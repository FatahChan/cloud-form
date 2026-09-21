import { Link } from "@tanstack/react-router";
import { CloudFormLogoLink } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
        <Link to="/" className="inline-flex h-14 items-center text-foreground hover:text-foreground">
          <CloudFormLogoLink />
        </Link>
        <Link to="/" hash="examples" className="hidden h-14 items-center text-sm text-muted-foreground hover:text-foreground sm:inline-flex">
          Examples
        </Link>
        <Link to="/" hash="compare" className="hidden h-14 items-center text-sm text-muted-foreground hover:text-foreground md:inline-flex">
          Compare
        </Link>
        <Link to="/" hash="faq" className="hidden h-14 items-center text-sm text-muted-foreground hover:text-foreground sm:inline-flex">
          FAQ
        </Link>
        <a
          href="https://github.com/FatahChan/cloud-form"
          className="hidden h-14 items-center text-sm text-muted-foreground hover:text-foreground lg:inline-flex"
        >
          GitHub
        </a>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button size="sm" asChild>
            <a href="https://github.com/FatahChan/cloud-form">View repo</a>
          </Button>
        </div>
      </div>
    </header>
  );
}

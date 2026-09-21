import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { PageMeta } from "@/components/page-meta";
import { SiteHeader } from "@/components/site-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormPlayer } from "~/player/FormPlayer";
import { getFormTemplate } from "~/shared/form-templates";
import { exampleDescription, exampleTitle } from "~/shared/seo";

export function ExamplePage({ slug }: { slug: string }) {
  const template = getFormTemplate(slug);
  const built = useMemo(() => template?.build(), [template]);

  if (!template || !built) {
    return (
      <div className="min-h-svh bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-6xl px-4 py-16">
          <Alert variant="destructive">
            <AlertDescription>No template named “{slug}”.</AlertDescription>
          </Alert>
          <Button variant="link" className="mt-4 px-0" asChild>
            <Link to="/" hash="examples">
              Back to examples
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <PageMeta title={exampleTitle(template.name)} description={exampleDescription(template.name, template.description)} />
      <SiteHeader />
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{template.name}</p>
          <p className="text-xs text-muted-foreground">Preview — answers are not saved.</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/" hash="examples">
            All examples
          </Link>
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <FormPlayer mode="preview" schema={built.schema} />
      </div>
    </div>
  );
}

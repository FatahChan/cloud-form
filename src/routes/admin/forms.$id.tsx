import { Link, Outlet, createFileRoute, useChildMatches } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Builder } from "~/builder/Builder";
import { api, ApiError } from "~/lib/api";
import type { FormSchema } from "~/shared/schema";

export const Route = createFileRoute("/admin/forms/$id")({
  component: FormBuilderPage,
});

function FormBuilderPage() {
  const { id } = Route.useParams();
  const nested = useChildMatches().length > 0;
  const [data, setData] = useState<{
    title: string;
    slug: string;
    published: boolean;
    schema: FormSchema;
    publishedSchema: FormSchema | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (nested) return;
    void api<{
      title: string;
      slug: string;
      published: boolean;
      schema: FormSchema;
      publishedSchema: FormSchema | null;
    }>("/api/forms/" + id)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed"));
  }, [id, nested]);

  if (nested) return <Outlet />;
  if (error)
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  if (!data) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin">Forms</Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/forms/$id/inbox" params={{ id }}>
            Inbox
          </Link>
        </Button>
      </div>
      <Builder
        formId={id}
        title={data.title}
        slug={data.slug}
        published={data.published}
        schema={data.schema}
        publishedSchema={data.publishedSchema}
        onMeta={(p) =>
          setData((d) =>
            d
              ? {
                  ...d,
                  title: p.title,
                  published: p.published,
                  publishedSchema: p.publishedSchema !== undefined ? p.publishedSchema : d.publishedSchema,
                }
              : d,
          )
        }
      />
    </div>
  );
}

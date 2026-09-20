import { Link, Outlet, createFileRoute, useChildMatches, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Page } from "@/components/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FORM_TEMPLATES } from "~/shared/form-templates";
import { api, ApiError } from "~/lib/api";

export const Route = createFileRoute("/admin/templates")({
  component: TemplatesPage,
});

function TemplatesPage() {
  const nested = useChildMatches().length > 0;
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (nested) return <Outlet />;

  async function createFromTemplate(templateId: string) {
    const template = FORM_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setError(null);
    setBusy(templateId);
    try {
      const { title, schema } = template.build();
      const form = await api<{ id: string }>("/api/forms", {
        method: "POST",
        body: JSON.stringify({ title, schema }),
      });
      await navigate({ to: "/admin/forms/$id", params: { id: form.id } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Create failed");
      setBusy(null);
    }
  }

  return (
    <Page title="Templates" description="Start from a common form layout, then customize in the builder.">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FORM_TEMPLATES.map((template) => (
          <Card key={template.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-base">{template.name}</CardTitle>
              <CardDescription>{template.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1" />
            <CardFooter className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/templates/$templateId/preview" params={{ templateId: template.id }}>
                  Preview
                </Link>
              </Button>
              <Button
                size="sm"
                type="button"
                disabled={busy === template.id}
                onClick={() => void createFromTemplate(template.id)}
              >
                {busy === template.id ? "Creating…" : "Create"}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </Page>
  );
}

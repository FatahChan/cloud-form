import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormPlayer } from "~/player/FormPlayer";
import { getFormTemplate } from "~/shared/form-templates";
import { api, ApiError } from "~/lib/api";

export const Route = createFileRoute("/admin/templates/$templateId/preview")({
  component: TemplatePreviewPage,
});

function TemplatePreviewPage() {
  const { templateId } = Route.useParams();
  const navigate = useNavigate();
  const template = getFormTemplate(templateId);
  const built = useMemo(() => template?.build(), [template]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!template || !built) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>Template not found.</AlertDescription>
        </Alert>
        <Button variant="link" className="mt-4 px-0" asChild>
          <Link to="/admin/templates">Back to templates</Link>
        </Button>
      </div>
    );
  }

  async function create() {
    setError(null);
    setBusy(true);
    try {
      const form = await api<{ id: string }>("/api/forms", {
        method: "POST",
        body: JSON.stringify({ title: built.title, schema: built.schema }),
      });
      await navigate({ to: "/admin/forms/$id", params: { id: form.id } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Create failed");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/templates">Templates</Link>
          </Button>
          <span className="text-sm font-medium">{template.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="button" disabled={busy} onClick={() => void create()}>
            {busy ? "Creating…" : "Create form"}
          </Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <FormPlayer mode="preview" schema={built.schema} />
      </div>
    </div>
  );
}

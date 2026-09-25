import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Page } from "@/components/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "~/lib/api";
import { FORM_SPEC_EXAMPLE, FORM_SPEC_SCHEMA_PATH, parseFormSpec } from "~/shared/form-spec";
import { FILE_KINDS } from "~/shared/schema";

export const Route = createFileRoute("/admin/forms/from-schema")({
  ssr: false,
  component: FromSchemaPage,
});

const SCHEMA_URL = typeof window === "undefined" ? FORM_SPEC_SCHEMA_PATH : window.location.origin + FORM_SPEC_SCHEMA_PATH;
const EXAMPLE = JSON.stringify({ $schema: SCHEMA_URL, ...FORM_SPEC_EXAMPLE }, null, 2);

const TYPE_FIELDS: [string, string][] = [
  ["short_text", "placeholder, regex"],
  ["long_text · email · phone", "placeholder"],
  ["number", "min, max"],
  ["select · multi_select", "options (2–26, required)"],
  ["date", "—"],
  ["file", `accept (${Object.keys(FILE_KINDS).join(", ")}), maxSizeMb (1–25)`],
  ["statement", "text only, no answer, no required"],
];

function FromSchemaPage() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const result = useMemo(() => (text.trim() ? parseFormSpec(text) : null), [text]);

  async function create() {
    if (!result?.ok) return;
    setError(null);
    setBusy(true);
    try {
      const form = await api<{ id: string }>("/api/forms", {
        method: "POST",
        body: JSON.stringify({ title: result.title, schema: result.schema }),
      });
      await navigate({ to: "/admin/forms/$id", params: { id: form.id } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Create failed");
      setBusy(false);
    }
  }

  const questionCount = result?.ok ? result.schema.questions.length : 0;
  const pageCount = result?.ok ? (result.schema.pages?.length ?? 0) : 0;

  return (
    <Page
      title="New form from schema"
      description="Paste JSON that follows the example. It is validated as you type, then opened in the builder."
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your schema</CardTitle>
            <CardDescription>Paste JSON text or load a .json file.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="file"
              accept=".json,application/json"
              aria-label="Load JSON file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void file.text().then(setText);
              }}
            />
            <Textarea
              aria-label="Form schema JSON"
              rows={24}
              spellCheck={false}
              className="font-mono text-xs"
              placeholder={'{\n  "title": "My form",\n  "pages": [ … ]\n}'}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {result && !result.ok && (
              <Alert variant="destructive">
                <AlertTitle>Schema is not valid</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc space-y-1 pl-4 font-mono text-xs">
                    {result.errors.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {result?.ok && (
              <Alert>
                <AlertTitle>Schema is valid</AlertTitle>
                <AlertDescription>
                  “{result.title}”: {pageCount} page{pageCount === 1 ? "" : "s"}, {questionCount} question
                  {questionCount === 1 ? "" : "s"}.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter>
            <Button type="button" disabled={!result?.ok || busy} onClick={() => void create()}>
              {busy ? "Creating…" : "Create form"}
            </Button>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Example schema</CardTitle>
            <CardDescription>
              Every question needs <code>type</code> and <code>title</code>. <code>description</code> is optional and{" "}
              <code>required</code> defaults to true. <code>welcome</code> and <code>ending</code> are optional. Keep the{" "}
              <code>$schema</code> line and editors like Cursor or VS Code validate and autocomplete the file as you type.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="grid gap-1 text-xs">
              {TYPE_FIELDS.map(([type, fields]) => (
                <li key={type} className="grid grid-cols-[11rem_1fr] gap-2">
                  <code className="font-medium">{type}</code>
                  <span className="text-muted-foreground">{fields}</span>
                </li>
              ))}
            </ul>
            <pre className="max-h-[32rem] overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs">{EXAMPLE}</pre>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setText(EXAMPLE)}>
              Use example
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void navigator.clipboard.writeText(EXAMPLE).then(
                  () => toast.success("Example copied"),
                  () => toast.error("Copy failed"),
                )
              }
            >
              Copy
            </Button>
            <Button variant="ghost" asChild>
              <a href={FORM_SPEC_SCHEMA_PATH} target="_blank" rel="noreferrer">
                JSON Schema
              </a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </Page>
  );
}

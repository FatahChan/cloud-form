import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Field } from "@/components/field";
import { Page } from "@/components/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "~/lib/api";
import { columnQuestions, type ColumnQuestion, type FormSchema } from "~/shared/schema";

type InboxFile = { id: string; submission_id?: string; filename: string; question_id: string };

function fileHref(formId: string, sid: string, fileId: string) {
  return "/api/forms/" + formId + "/submissions/" + sid + "/files/" + fileId;
}

function FileLink(props: { formId: string; sid: string; file: InboxFile }) {
  return (
    <Button variant="link" className="h-auto p-0" asChild>
      <a href={fileHref(props.formId, props.sid, props.file.id)}>{props.file.filename}</a>
    </Button>
  );
}

function answer(formId: string, sid: string, q: ColumnQuestion, value: unknown, files: InboxFile[]) {
  if (q.type === "file") {
    const f = files.find((x) => x.question_id === q.id && (!x.submission_id || x.submission_id === sid));
    return f ? <FileLink formId={formId} sid={sid} file={f} /> : null;
  }
  return String(value ?? "");
}

export const Route = createFileRoute("/admin/forms/$id/inbox")({
  component: InboxPage,
});

function InboxPage() {
  const { id } = Route.useParams();
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [files, setFiles] = useState<InboxFile[]>([]);
  const [slug, setSlug] = useState("");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<{
    submission: Record<string, unknown>;
    files: InboxFile[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cols = useMemo(() => (schema ? columnQuestions(schema) : []), [schema]);

  async function load(filter?: { slug: string; q: string }) {
    const qs =
      filter?.slug && filter.q
        ? `?slug=${encodeURIComponent(filter.slug)}&q=${encodeURIComponent(filter.q)}`
        : "";
    const data = await api<{ schema: FormSchema; submissions: Record<string, unknown>[]; files: InboxFile[] }>(
      "/api/forms/" + id + "/submissions" + qs,
    );
    setSchema(data.schema);
    setRows(data.submissions);
    setFiles(data.files ?? []);
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof ApiError ? e.message : "Failed"));
  }, [id]);

  return (
    <Page
      title="Inbox"
      action={
        <Button variant="outline" asChild>
          <Link to="/admin/forms/$id" params={{ id }}>
            Builder
          </Link>
        </Button>
      }
    >
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void load({ slug, q }).catch((err) => setError(err instanceof ApiError ? err.message : "Failed"));
        }}
      >
        <Field label="Field">
          <Select value={slug || "any"} onValueChange={(v) => setSlug(v === "any" ? "" : v)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              {cols.map((c) => (
                <SelectItem key={c.id} value={c.slug}>
                  {c.title} ({c.slug})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Exact value">
          <Input value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
        </Field>
        <Button type="submit">Search</Button>
      </form>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              {cols.map((c) => (
                <TableHead key={c.id}>{c.title}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={1 + cols.length} className="text-muted-foreground">
                  No submissions.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={String(row.id)}>
                  <TableCell>
                    <Button
                      variant="link"
                      className="h-auto p-0"
                      type="button"
                      onClick={() => {
                        void api<{
                          submission: Record<string, unknown>;
                          files: InboxFile[];
                        }>("/api/forms/" + id + "/submissions/" + String(row.id))
                          .then(setDetail)
                          .catch((e) => setError(e instanceof ApiError ? e.message : "Failed"));
                      }}
                    >
                      {row.created_at ? new Date(Number(row.created_at)).toLocaleString() : String(row.id)}
                    </Button>
                  </TableCell>
                  {cols.map((c) => (
                    <TableCell key={c.id}>{answer(id, String(row.id), c, row[c.slug], files)}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {detail && schema && (
        <Card>
          <CardHeader>
            <CardTitle>Submission</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {cols.map((c) => (
              <p key={c.id} className="text-sm">
                <span className="font-medium">{c.title}</span>{" "}
                <span className="text-muted-foreground">
                  {answer(id, String(detail.submission.id), c, detail.submission[c.slug], detail.files)}
                </span>
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </Page>
  );
}

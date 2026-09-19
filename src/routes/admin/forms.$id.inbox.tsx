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
import { columnQuestions, type FormSchema } from "~/shared/schema";

export const Route = createFileRoute("/admin/forms/$id/inbox")({
  component: InboxPage,
});

function InboxPage() {
  const { id } = Route.useParams();
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [slug, setSlug] = useState("");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<{
    submission: Record<string, unknown>;
    files: { id: string; filename: string; question_id: string }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cols = useMemo(() => (schema ? columnQuestions(schema) : []), [schema]);

  async function load(filter?: { slug: string; q: string }) {
    const qs =
      filter?.slug && filter.q
        ? `?slug=${encodeURIComponent(filter.slug)}&q=${encodeURIComponent(filter.q)}`
        : "";
    const data = await api<{ schema: FormSchema; submissions: Record<string, unknown>[] }>(
      "/api/forms/" + id + "/submissions" + qs,
    );
    setSchema(data.schema);
    setRows(data.submissions);
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
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              {cols.slice(0, 4).map((c) => (
                <TableHead key={c.id}>{c.title}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={1 + Math.min(4, cols.length)} className="text-muted-foreground">
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
                          files: { id: string; filename: string; question_id: string }[];
                        }>("/api/forms/" + id + "/submissions/" + String(row.id))
                          .then(setDetail)
                          .catch((e) => setError(e instanceof ApiError ? e.message : "Failed"));
                      }}
                    >
                      {row.created_at ? new Date(Number(row.created_at)).toLocaleString() : String(row.id)}
                    </Button>
                  </TableCell>
                  {cols.slice(0, 4).map((c) => (
                    <TableCell key={c.id}>{String(row[c.slug] ?? "")}</TableCell>
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
            {columnQuestions(schema).map((c) => (
              <p key={c.id} className="text-sm">
                <span className="font-medium">{c.title}</span>{" "}
                <span className="text-muted-foreground">{String(detail.submission[c.slug] ?? "")}</span>
              </p>
            ))}
            {detail.files.map((f) => (
              <p key={f.id}>
                <Button variant="link" className="h-auto p-0" asChild>
                  <a href={"/api/forms/" + id + "/submissions/" + String(detail.submission.id) + "/files/" + f.id}>
                    {f.filename}
                  </a>
                </Button>
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </Page>
  );
}

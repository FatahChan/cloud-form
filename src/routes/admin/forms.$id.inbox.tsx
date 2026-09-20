import { createColumnHelper } from "@tanstack/react-table";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { DataTable } from "@/components/data-table";
import { type DataTableFeatures } from "@/components/data-table-features";
import { Page } from "@/components/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ApiError } from "~/lib/api";
import { columnQuestions, type ColumnQuestion, type FormSchema } from "~/shared/schema";

type InboxFile = { id: string; submission_id?: string; filename: string; question_id: string };
type InboxRow = { id: string; created_at: number; [key: string]: unknown };

function fileHref(formId: string, sid: string, fileId: string) {
  return "/api/forms/" + formId + "/submissions/" + sid + "/files/" + fileId;
}

function FileLink(props: { formId: string; sid: string; file: InboxFile }) {
  return (
    <Button variant="link" className="h-auto p-0" asChild>
      <a href={fileHref(props.formId, props.sid, props.file.id)}>
        {props.file.filename}
      </a>
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

const columnHelper = createColumnHelper<DataTableFeatures, InboxRow>();

export const Route = createFileRoute("/admin/forms/$id/inbox")({
  component: InboxPage,
});

function InboxPage() {
  const { id } = Route.useParams();
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [files, setFiles] = useState<InboxFile[]>([]);
  const [slug, setSlug] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [prevCursors, setPrevCursors] = useState<(string | null)[]>([]);
  const [continueCursor, setContinueCursor] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const listFilter = `${id}|${slug}|${search}|${pageSize}`;
  const listCursorRef = useRef(listFilter);
  const cols = useMemo(() => (schema ? columnQuestions(schema) : []), [schema]);

  useEffect(() => {
    if (q === search) return;
    const t = setTimeout(() => setSearch(q), 300);
    return () => clearTimeout(t);
  }, [q, search]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (slug) params.set("slug", slug);
    if (search.trim()) params.set("q", search.trim());
    const cursorToUse = listCursorRef.current === listFilter ? cursor : null;
    if (listCursorRef.current !== listFilter) {
      listCursorRef.current = listFilter;
      if (cursor !== null) {
        setCursor(null);
        setPrevCursors([]);
      }
    }
    if (cursorToUse) params.set("cursor", cursorToUse);
    params.set("limit", String(pageSize));
    void api<{
      schema: FormSchema;
      submissions: InboxRow[];
      files: InboxFile[];
      continueCursor: string | null;
      isDone: boolean;
    }>("/api/forms/" + id + "/submissions?" + params.toString())
      .then((data) => {
        if (cancelled) return;
        setSchema(data.schema);
        setRows(data.submissions);
        setFiles(data.files ?? []);
        setContinueCursor(data.continueCursor);
        setIsDone(data.isDone);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Failed");
      });
    return () => {
      cancelled = true;
    };
  }, [id, slug, search, cursor, pageSize, listFilter]);

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor((row) => (row.created_at ? new Date(Number(row.created_at)).toLocaleString() : String(row.id)), {
          id: "created_at",
          header: "When",
        }),
        ...cols.map((c) =>
          columnHelper.accessor((row) => String(row[c.slug] ?? ""), {
            id: c.slug,
            header: c.title,
            cell: ({ row }) => answer(id, String(row.original.id), c, row.original[c.slug], files),
          }),
        ),
      ]),
    [cols, files, id],
  );

  return (
    <Page
      title="Inbox"
      action={
        <Button variant="outline" asChild>
          <Link to="/admin/forms/$id" params={{ id }}>
            Form
          </Link>
        </Button>
      }
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => String(row.id)}
        searchPlaceholder="Search submissions…"
        search={q}
        onSearchChange={setQ}
        empty={search.trim() || slug ? "No matching submissions." : "No submissions."}
        toolbar={
          <Select
            value={slug || "any"}
            onValueChange={(v) => {
              setSlug(v === "any" ? "" : v);
              setCursor(null);
              setPrevCursors([]);
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Any field" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any field</SelectItem>
              {cols.map((c) => (
                <SelectItem key={c.id} value={c.slug}>
                  {c.title} ({c.slug})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        pagination={{
          canPreviousPage: prevCursors.length > 0,
          canNextPage: !isDone && !!continueCursor,
          onPreviousPage: () => {
            const prev = prevCursors[prevCursors.length - 1];
            setPrevCursors((stack) => stack.slice(0, -1));
            setCursor(prev ?? null);
          },
          onNextPage: () => {
            if (!continueCursor) return;
            setPrevCursors((stack) => [...stack, cursor]);
            setCursor(continueCursor);
          },
          pageSize,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setCursor(null);
            setPrevCursors([]);
          },
        }}
      />
    </Page>
  );
}

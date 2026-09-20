import {
  fileKindFor,
  liveQuestions,
  normalizeFormSchema,
  normalizePhone,
  type ColumnQuestion,
  type FormSchema,
  type Question,
} from "../../shared/schema";
import { parseAnswers } from "../../shared/answers";
import { HttpError } from "../errors";
import { copyPending, putPending } from "../files";
import { columnName, tableName } from "../formTable";
import { parseStored, type FormRow } from "./forms";
import { env } from "../http";

function fileQuestion(schema: FormSchema, questionId: string): Extract<Question, { type: "file" }> | null {
  const q = liveQuestions(schema).find((x) => x.id === questionId);
  return q?.type === "file" ? q : null;
}

async function publishedForm(slug: string): Promise<{ row: FormRow; schema: FormSchema }> {
  const row = await env.DB.prepare("SELECT * FROM forms WHERE slug = ? AND published = 1").bind(slug).first<FormRow>();
  if (!row || !row.published_schema) throw new HttpError("Not found", 404);
  return { row, schema: normalizeFormSchema(JSON.parse(row.published_schema) as FormSchema) };
}

export async function getPublicForm(slug: string) {
  const { row, schema } = await publishedForm(slug);
  return { id: row.id, slug: row.slug, title: row.title, schema };
}

export async function uploadPublicFile(slug: string, file: File, questionId: string) {
  const { row, schema } = await publishedForm(slug);
  if (!file) throw new HttpError("file required", 400);
  const q = fileQuestion(schema, questionId);
  if (!q) throw new HttpError("Invalid question", 400);
  const max = q.maxSizeMb * 1024 * 1024;
  if (file.size > max) throw new HttpError("File too large", 413);
  const mime = file.type;
  if (!mime) throw new HttpError("Unknown file type", 415);
  const kind = fileKindFor(file.name, mime);
  if (!kind || !q.accept.includes(kind)) throw new HttpError("File type not allowed", 415);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > max) throw new HttpError("File too large", 413);
  const uploadId = crypto.randomUUID();
  const key = `pending/${row.id}/${questionId}/${uploadId}`;
  await putPending(key, bytes, mime, file.name);
  return { uploadId };
}

export async function submitPublic(slug: string, answers: unknown) {
  const { row, schema } = await publishedForm(slug);
  const parsed = parseAnswers(schema, answers);
  if (!parsed.ok) throw new HttpError(parsed.error, 400);

  const submissionId = crypto.randomUUID();
  const table = tableName(row.id);
  const cols: ColumnQuestion[] = schema.questions.filter((q): q is ColumnQuestion => q.type !== "statement");

  const destKeys: {
    q: Extract<Question, { type: "file" }>;
    uploadId: string;
    pending: string;
    dest: string;
    obj: R2ObjectBody;
  }[] = [];
  for (const q of cols) {
    if (q.type !== "file") continue;
    const ans = parsed.data[q.id] as { uploadId: string } | undefined;
    if (!ans) continue;
    const pending = `pending/${row.id}/${q.id}/${ans.uploadId}`;
    const dest = `submissions/${submissionId}/${ans.uploadId}`;
    const obj = await copyPending(pending, dest);
    if (!obj) throw new HttpError("Missing upload", 400);
    destKeys.push({ q, uploadId: ans.uploadId, pending, dest, obj });
  }

  const colSql = cols.map((q) => `"${columnName(q.slug)}"`).join(", ");
  const placeholders = cols.map(() => "?").join(", ");
  const values = cols.map((q) => {
    const v = parsed.data[q.id];
    if (v === undefined) return null;
    if (q.type === "file") return (v as { uploadId: string }).uploadId;
    if (q.type === "multi_select") return JSON.stringify(v);
    return v as string | number;
  });

  const stmts = [
    env.DB.prepare("INSERT INTO submissions (id, form_id, created_at) VALUES (?, ?, ?)").bind(
      submissionId,
      row.id,
      Date.now(),
    ),
    env.DB.prepare(
      `INSERT INTO ${table} (id, created_at${colSql ? ", " + colSql : ""}) VALUES (?, ?${cols.length ? ", " + placeholders : ""})`,
    ).bind(submissionId, Date.now(), ...values),
  ];
  for (const d of destKeys) {
    stmts.push(
      env.DB.prepare(
        "INSERT INTO files (id, submission_id, question_id, upload_id, r2_key, filename, content_type, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        crypto.randomUUID(),
        submissionId,
        d.q.id,
        d.uploadId,
        d.dest,
        d.obj.customMetadata?.filename ?? d.q.title,
        d.obj.httpMetadata?.contentType ?? "application/octet-stream",
        d.obj.size,
      ),
    );
  }
  await env.DB.batch(stmts);
  for (const d of destKeys) await env.FILES.delete(d.pending);
  return { ok: true, id: submissionId };
}

type InboxFileRow = { id: string; submission_id: string; question_id: string; filename: string };
type InboxRow = { id: string; created_at: number; [key: string]: unknown };

export type InboxListFilter = {
  slug?: string | null;
  q?: string | null;
  cursor?: string | null;
  limit?: number | string | null;
};

function pageLimit(raw: number | string | null | undefined): number {
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (n == null || !Number.isFinite(n)) return 20;
  return Math.min(100, Math.max(1, Math.floor(n)));
}

function parseCursor(cursor: string | null | undefined): { created_at: number; id: string } | null {
  if (!cursor) return null;
  const i = cursor.indexOf(":");
  if (i <= 0) throw new HttpError("Invalid cursor", 400);
  const created_at = Number(cursor.slice(0, i));
  const id = cursor.slice(i + 1);
  if (!Number.isFinite(created_at) || !id) throw new HttpError("Invalid cursor", 400);
  return { created_at, id };
}

function encodeCursor(row: { id: string; created_at: number | string }): string {
  return `${Number(row.created_at)}:${row.id}`;
}

function likePattern(q: string): string {
  return `%${q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
}

function searchClause(
  schema: FormSchema,
  existing: Set<string>,
  slug: string | null,
  q: string | null,
): { sql: string; binds: string[] } {
  const term = q?.trim() ?? "";
  if (!term) return { sql: "1=1", binds: [] };
  const cols = schema.questions.filter((x): x is ColumnQuestion => x.type !== "statement");
  if (slug) {
    const col = cols.find((x) => x.slug === slug);
    if (!col) throw new HttpError("Unknown field", 400);
    if (!existing.has(columnName(col.slug))) return { sql: "0", binds: [] };
    const value =
      col.type === "email" ? term.toLowerCase() : col.type === "phone" ? (normalizePhone(term) ?? term) : term;
    return { sql: `"${columnName(col.slug)}" LIKE ? ESCAPE '\\'`, binds: [likePattern(value)] };
  }
  const searchable = cols.filter((c) => c.type !== "file" && existing.has(columnName(c.slug)));
  if (!searchable.length) return { sql: "1=1", binds: [] };
  const sql = searchable.map((c) => `CAST("${columnName(c.slug)}" AS TEXT) LIKE ? ESCAPE '\\'`).join(" OR ");
  return { sql: `(${sql})`, binds: searchable.map(() => likePattern(term)) };
}

export async function listInbox(formId: string, filter?: InboxListFilter) {
  const row = await env.DB.prepare("SELECT * FROM forms WHERE id = ?").bind(formId).first<FormRow>();
  if (!row) throw new HttpError("Not found", 404);
  const { schema } = parseStored(row);
  const table = tableName(formId);
  const empty = {
    schema,
    submissions: [] as InboxRow[],
    files: [] as InboxFileRow[],
    continueCursor: null as string | null,
    isDone: true,
  };
  const exists = await env.DB.prepare("SELECT 1 AS n FROM sqlite_master WHERE type = 'table' AND name = ?")
    .bind(table)
    .first();
  if (!exists) return empty;
  const info = await env.DB.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  const existing = new Set((info.results ?? []).map((c) => c.name));
  const limit = pageLimit(filter?.limit);
  const cursor = parseCursor(filter?.cursor);
  const search = searchClause(schema, existing, filter?.slug ?? null, filter?.q ?? null);
  const where = [search.sql];
  const binds: (string | number)[] = [...search.binds];
  if (cursor) {
    where.push("(created_at < ? OR (created_at = ? AND id < ?))");
    binds.push(cursor.created_at, cursor.created_at, cursor.id);
  }
  const sql = `SELECT * FROM ${table} WHERE ${where.join(" AND ")} ORDER BY created_at DESC, id DESC LIMIT ?`;
  binds.push(limit + 1);
  const { results } = await env.DB.prepare(sql).bind(...binds).all<InboxRow>();
  const rows = results ?? [];
  const hasMore = rows.length > limit;
  const submissions = hasMore ? rows.slice(0, limit) : rows;
  const continueCursor = hasMore && submissions.length ? encodeCursor(submissions[submissions.length - 1]!) : null;
  let files: InboxFileRow[] = [];
  if (submissions.length) {
    const placeholders = submissions.map(() => "?").join(", ");
    const listed = await env.DB.prepare(
      `SELECT id, submission_id, question_id, filename FROM files WHERE submission_id IN (${placeholders})`,
    )
      .bind(...submissions.map((s) => s.id))
      .all<InboxFileRow>();
    files = listed.results ?? [];
  }
  return { schema, submissions, files, continueCursor, isDone: !hasMore };
}

export async function getSubmission(formId: string, sid: string) {
  const row = await env.DB.prepare("SELECT * FROM forms WHERE id = ?").bind(formId).first<FormRow>();
  if (!row) throw new HttpError("Not found", 404);
  const { schema } = parseStored(row);
  const table = tableName(formId);
  const sub = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(sid).first();
  if (!sub) throw new HttpError("Not found", 404);
  const { results: files } = await env.DB.prepare("SELECT * FROM files WHERE submission_id = ?").bind(sid).all();
  return { schema, submission: sub, files: files ?? [] };
}

export async function downloadSubmissionFile(formId: string, sid: string, fileId: string) {
  const file = await env.DB.prepare("SELECT * FROM files WHERE id = ? AND submission_id = ?")
    .bind(fileId, sid)
    .first<{ r2_key: string; filename: string; content_type: string }>();
  if (!file) throw new HttpError("Not found", 404);
  const obj = await env.FILES.get(file.r2_key);
  if (!obj) throw new HttpError("Not found", 404);
  return {
    body: obj.body,
    contentType: file.content_type,
    filename: file.filename,
  };
}

import {
  fileKindFor,
  liveQuestions,
  normalizePhone,
  parseAnswers,
  type ColumnQuestion,
  type FormSchema,
  type Question,
} from "../shared/schema";
import { requireUser } from "./auth";
import { copyPending, putPending } from "./files";
import { columnName, tableName } from "./formTable";
import { parseStored, type FormRow } from "./forms";
import { authed, env, err, json } from "./http";

function fileQuestion(schema: FormSchema, questionId: string): Extract<Question, { type: "file" }> | null {
  const q = liveQuestions(schema).find((x) => x.id === questionId);
  return q?.type === "file" ? q : null;
}

export async function handlePublicForm(slug: string): Promise<Response> {
  const row = await env.DB.prepare("SELECT * FROM forms WHERE slug = ? AND published = 1").bind(slug).first<FormRow>();
  if (!row || !row.published_schema) return err("Not found", 404);
  const schema = JSON.parse(row.published_schema) as FormSchema;
  return json({ id: row.id, slug: row.slug, title: row.title, schema });
}

export async function handlePublicUpload(request: Request, slug: string): Promise<Response> {
  const row = await env.DB.prepare("SELECT * FROM forms WHERE slug = ? AND published = 1").bind(slug).first<FormRow>();
  if (!row || !row.published_schema) return err("Not found", 404);
  const schema = JSON.parse(row.published_schema) as FormSchema;
  const form = await request.formData();
  const file = form.get("file");
  const questionId = String(form.get("questionId") ?? "");
  if (!(file instanceof File)) return err("file required", 400);
  const q = fileQuestion(schema, questionId);
  if (!q) return err("Invalid question", 400);
  const max = q.maxSizeMb * 1024 * 1024;
  if (file.size > max) return err("File too large", 413);
  const mime = file.type;
  if (!mime) return err("Unknown file type", 415);
  const kind = fileKindFor(file.name, mime);
  if (!kind || !q.accept.includes(kind)) return err("File type not allowed", 415);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > max) return err("File too large", 413);
  const uploadId = crypto.randomUUID();
  const key = `pending/${row.id}/${questionId}/${uploadId}`;
  await putPending(key, bytes, mime, file.name);
  return json({ uploadId });
}

export async function handlePublicSubmit(request: Request, slug: string): Promise<Response> {
  const row = await env.DB.prepare("SELECT * FROM forms WHERE slug = ? AND published = 1").bind(slug).first<FormRow>();
  if (!row || !row.published_schema) return err("Not found", 404);
  const schema = JSON.parse(row.published_schema) as FormSchema;
  const body = (await request.json().catch(() => null)) as { answers?: unknown } | null;
  const parsed = parseAnswers(schema, body?.answers);
  if (!parsed.ok) return err(parsed.error, 400);

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
    if (!obj) return err("Missing upload", 400);
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
  return json({ ok: true, id: submissionId });
}

export async function handleInbox(request: Request, formId: string): Promise<Response> {
  const s = await requireUser(request);
  if (s instanceof Response) return s;
  const row = await env.DB.prepare("SELECT * FROM forms WHERE id = ?").bind(formId).first<FormRow>();
  if (!row) return authed(err("Not found", 404), s.setCookie);
  const { published, schema } = parseStored(row);
  const use = published ?? schema;
  const table = tableName(formId);
  const exists = await env.DB.prepare("SELECT 1 AS n FROM sqlite_master WHERE type = 'table' AND name = ?")
    .bind(table)
    .first();
  if (!exists) return authed(json({ schema: use, submissions: [] }), s.setCookie);
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const q = url.searchParams.get("q");
  let sql = `SELECT * FROM ${table} ORDER BY created_at DESC LIMIT 200`;
  const binds: string[] = [];
  if (slug && q) {
    const col = use.questions.find((x) => x.type !== "statement" && x.slug === slug);
    if (!col || col.type === "statement") return authed(err("Unknown field", 400), s.setCookie);
    sql = `SELECT * FROM ${table} WHERE "${columnName(col.slug)}" = ? ORDER BY created_at DESC LIMIT 200`;
    binds.push(col.type === "email" ? q.trim().toLowerCase() : col.type === "phone" ? (normalizePhone(q) ?? q.trim()) : q);
  }
  const stmt = env.DB.prepare(sql);
  const { results } = binds.length ? await stmt.bind(...binds).all() : await stmt.all();
  return authed(json({ schema: use, submissions: results }), s.setCookie);
}

export async function handleSubmission(request: Request, formId: string, sid: string): Promise<Response> {
  const s = await requireUser(request);
  if (s instanceof Response) return s;
  const row = await env.DB.prepare("SELECT * FROM forms WHERE id = ?").bind(formId).first<FormRow>();
  if (!row) return authed(err("Not found", 404), s.setCookie);
  const { published, schema } = parseStored(row);
  const use = published ?? schema;
  const table = tableName(formId);
  const sub = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(sid).first();
  if (!sub) return authed(err("Not found", 404), s.setCookie);
  const { results: files } = await env.DB.prepare("SELECT * FROM files WHERE submission_id = ?").bind(sid).all();
  return authed(json({ schema: use, submission: sub, files: files ?? [] }), s.setCookie);
}

export async function handleDownload(request: Request, formId: string, sid: string, fileId: string): Promise<Response> {
  const s = await requireUser(request);
  if (s instanceof Response) return s;
  const file = await env.DB.prepare("SELECT * FROM files WHERE id = ? AND submission_id = ?")
    .bind(fileId, sid)
    .first<{ r2_key: string; filename: string; content_type: string }>();
  if (!file) return authed(err("Not found", 404), s.setCookie);
  const obj = await env.FILES.get(file.r2_key);
  if (!obj) return authed(err("Not found", 404), s.setCookie);
  return new Response(obj.body, {
    headers: {
      "Content-Type": file.content_type,
      "Content-Disposition": `attachment; filename="${file.filename.replace(/"/g, "")}"`,
    },
  });
}

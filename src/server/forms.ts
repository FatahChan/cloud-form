import {
  defaultFormSchema,
  parseFormSchema,
  publishSchemaError,
  schemaEditError,
  type FormSchema,
} from "../shared/schema";
import { requireUser } from "./auth";
import { insertAudit } from "./audit";
import { diffAndMigrate, tableName } from "./formTable";
import { authed, env, err, json } from "./http";
import { formPublicSlug } from "./session";

export type FormRow = {
  id: string;
  slug: string;
  title: string;
  published: number;
  schema: string;
  published_schema: string | null;
  created_by: string;
  created_at: number;
  updated_at: number;
};

export function parseStored(row: FormRow): { schema: FormSchema; published: FormSchema | null } {
  const schema = JSON.parse(row.schema) as FormSchema;
  const published = row.published_schema ? (JSON.parse(row.published_schema) as FormSchema) : null;
  return { schema, published };
}

export async function handleListForms(request: Request): Promise<Response> {
  const s = await requireUser(request);
  if (s instanceof Response) return s;
  if (request.method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT id, slug, title, published, updated_at FROM forms ORDER BY updated_at DESC",
    ).all();
    return authed(json({ forms: results }), s.setCookie);
  }
  const body = (await request.json().catch(() => null)) as { title?: string } | null;
  const title = body?.title?.trim() || "Untitled form";
  const id = crypto.randomUUID();
  const slug = formPublicSlug();
  const schema = defaultFormSchema();
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO forms (id, slug, title, published, schema, published_schema, created_by, created_at, updated_at) VALUES (?, ?, ?, 0, ?, NULL, ?, ?, ?)",
  )
    .bind(id, slug, title, JSON.stringify(schema), s.user.id, now, now)
    .run();
  await insertAudit({ actorId: s.user.id, action: "form.create", entityType: "form", entityId: id });
  return authed(json({ id, slug, title, published: 0, schema }), s.setCookie);
}

export async function handleForm(request: Request, id: string): Promise<Response> {
  const s = await requireUser(request);
  if (s instanceof Response) return s;
  const row = await env.DB.prepare("SELECT * FROM forms WHERE id = ?").bind(id).first<FormRow>();
  if (!row) return authed(err("Not found", 404), s.setCookie);

  if (request.method === "GET") {
    const { schema, published } = parseStored(row);
    return authed(
      json({
        id: row.id,
        slug: row.slug,
        title: row.title,
        published: !!row.published,
        schema,
        publishedSchema: published,
      }),
      s.setCookie,
    );
  }

  if (request.method === "PUT") {
    const body = (await request.json().catch(() => null)) as { title?: string; schema?: unknown } | null;
    const parsed = parseFormSchema(body?.schema);
    if (!parsed.ok) return authed(err(parsed.error, 400), s.setCookie);
    const title = body?.title?.trim();
    if (!title) return authed(err("Title required", 400), s.setCookie);
    const { schema: prev, published } = parseStored(row);
    const editErr = schemaEditError(prev, parsed.data, published);
    if (editErr) return authed(err(editErr, 400), s.setCookie);
    await env.DB.prepare("UPDATE forms SET title = ?, schema = ?, updated_at = ? WHERE id = ?")
      .bind(title, JSON.stringify(parsed.data), Date.now(), id)
      .run();
    await insertAudit({ actorId: s.user.id, action: "form.update", entityType: "form", entityId: id });
    return authed(json({ ok: true }), s.setCookie);
  }

  if (request.method === "DELETE") {
    const table = tableName(id);
    const { results: subs } = await env.DB.prepare("SELECT id FROM submissions WHERE form_id = ?").bind(id).all<{
      id: string;
    }>();
    for (const sub of subs ?? []) {
      const { results: files } = await env.DB.prepare("SELECT r2_key FROM files WHERE submission_id = ?")
        .bind(sub.id)
        .all<{ r2_key: string }>();
      for (const f of files ?? []) await env.FILES.delete(f.r2_key);
    }
    const listed = await env.FILES.list({ prefix: `pending/${id}/` });
    for (const obj of listed.objects) await env.FILES.delete(obj.key);
    await env.DB.exec(`DROP TABLE IF EXISTS ${table}`);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM files WHERE submission_id IN (SELECT id FROM submissions WHERE form_id = ?)").bind(id),
      env.DB.prepare("DELETE FROM submissions WHERE form_id = ?").bind(id),
      env.DB.prepare("DELETE FROM form_migrations WHERE form_id = ?").bind(id),
      env.DB.prepare("DELETE FROM forms WHERE id = ?").bind(id),
    ]);
    await insertAudit({ actorId: s.user.id, action: "form.delete", entityType: "form", entityId: id });
    return authed(json({ ok: true }), s.setCookie);
  }

  return authed(err("Method not allowed", 405), s.setCookie);
}

export async function handlePublish(request: Request, id: string): Promise<Response> {
  const s = await requireUser(request);
  if (s instanceof Response) return s;
  const body = (await request.json().catch(() => null)) as { published?: boolean } | null;
  const row = await env.DB.prepare("SELECT * FROM forms WHERE id = ?").bind(id).first<FormRow>();
  if (!row) return authed(err("Not found", 404), s.setCookie);
  const { schema, published } = parseStored(row);
  if (body?.published) {
    const pubErr = publishSchemaError(schema);
    if (pubErr) return authed(err(pubErr, 400), s.setCookie);
    await diffAndMigrate({ formId: id, next: schema, published, actorId: s.user.id });
    await env.DB.prepare("UPDATE forms SET published = 1, published_schema = ?, updated_at = ? WHERE id = ?")
      .bind(JSON.stringify(schema), Date.now(), id)
      .run();
    await insertAudit({ actorId: s.user.id, action: "form.publish", entityType: "form", entityId: id });
  } else {
    await env.DB.prepare("UPDATE forms SET published = 0, updated_at = ? WHERE id = ?").bind(Date.now(), id).run();
    await insertAudit({ actorId: s.user.id, action: "form.unpublish", entityType: "form", entityId: id });
  }
  return authed(json({ ok: true, published: !!body?.published }), s.setCookie);
}

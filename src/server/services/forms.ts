import {
  defaultFormSchema,
  normalizeFormSchema,
  parseFormSchema,
  publishSchemaError,
  schemaEditError,
  type FormSchema,
} from "../../shared/schema";
import { insertAudit } from "../audit";
import { HttpError } from "../errors";
import { diffAndMigrate, tableName } from "../formTable";
import { env } from "../http";
import { formPublicSlug, type SessionUser } from "../session";

export type FormRow = {
  id: string;
  slug: string;
  title: string;
  published: number;
  schema: string;
  published_schema: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: number;
  updated_at: number;
};

export type FormListItem = {
  id: string;
  slug: string;
  title: string;
  published: number;
  updated_at: number;
  created_by_name: string;
  updated_by_name: string;
};

export function parseStored(row: FormRow): { schema: FormSchema; published: FormSchema | null } {
  const schema = normalizeFormSchema(JSON.parse(row.schema) as FormSchema);
  const published = row.published_schema
    ? normalizeFormSchema(JSON.parse(row.published_schema) as FormSchema)
    : null;
  return { schema, published };
}

export async function listForms() {
  const { results } = await env.DB.prepare(
    `SELECT f.id, f.slug, f.title, f.published, f.updated_at,
            creator.name AS created_by_name,
            COALESCE(updater.name, creator.name) AS updated_by_name
     FROM forms f
     LEFT JOIN users creator ON creator.id = f.created_by
     LEFT JOIN users updater ON updater.id = f.updated_by
     ORDER BY f.updated_at DESC`,
  ).all<FormListItem>();
  return { forms: results ?? [] };
}

export async function createForm(user: SessionUser, input?: { title?: string; schema?: unknown }) {
  const t = input?.title?.trim() || "Untitled form";
  const id = crypto.randomUUID();
  const slug = formPublicSlug();
  let schema: FormSchema;
  if (input?.schema !== undefined) {
    const parsed = parseFormSchema(input.schema);
    if (!parsed.ok) throw new HttpError(parsed.error, 400);
    schema = parsed.data;
  } else {
    schema = defaultFormSchema();
  }
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO forms (id, slug, title, published, schema, published_schema, created_by, updated_by, created_at, updated_at) VALUES (?, ?, ?, 0, ?, NULL, ?, ?, ?, ?)",
  )
    .bind(id, slug, t, JSON.stringify(schema), user.id, user.id, now, now)
    .run();
  await insertAudit({ actorId: user.id, action: "form.create", entityType: "form", entityId: id });
  return { id, slug, title: t, published: 0, schema };
}

export async function getForm(id: string) {
  const row = await env.DB.prepare("SELECT * FROM forms WHERE id = ?").bind(id).first<FormRow>();
  if (!row) throw new HttpError("Not found", 404);
  const { schema, published } = parseStored(row);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    published: !!row.published,
    schema,
    publishedSchema: published,
  };
}

export async function updateForm(user: SessionUser, id: string, input: { title?: string; schema?: unknown }) {
  const row = await env.DB.prepare("SELECT * FROM forms WHERE id = ?").bind(id).first<FormRow>();
  if (!row) throw new HttpError("Not found", 404);
  const parsed = parseFormSchema(input.schema);
  if (!parsed.ok) throw new HttpError(parsed.error, 400);
  const title = input.title?.trim();
  if (!title) throw new HttpError("Title required", 400);
  const { schema: prev, published } = parseStored(row);
  const editErr = schemaEditError(prev, parsed.data, published);
  if (editErr) throw new HttpError(editErr, 400);
  await env.DB.prepare("UPDATE forms SET title = ?, schema = ?, updated_at = ?, updated_by = ? WHERE id = ?")
    .bind(title, JSON.stringify(parsed.data), Date.now(), user.id, id)
    .run();
  await insertAudit({ actorId: user.id, action: "form.update", entityType: "form", entityId: id });
  return { ok: true };
}

export async function deleteForm(user: SessionUser, id: string) {
  const row = await env.DB.prepare("SELECT id FROM forms WHERE id = ?").bind(id).first();
  if (!row) throw new HttpError("Not found", 404);
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
  await insertAudit({ actorId: user.id, action: "form.delete", entityType: "form", entityId: id });
  return { ok: true };
}

export async function publishForm(user: SessionUser, id: string, published: boolean) {
  const row = await env.DB.prepare("SELECT * FROM forms WHERE id = ?").bind(id).first<FormRow>();
  if (!row) throw new HttpError("Not found", 404);
  const { schema, published: prevPublished } = parseStored(row);
  if (published) {
    const pubErr = publishSchemaError(schema);
    if (pubErr) throw new HttpError(pubErr, 400);
    await diffAndMigrate({ formId: id, next: schema, published: prevPublished, actorId: user.id });
    await env.DB.prepare("UPDATE forms SET published = 1, published_schema = ?, updated_at = ?, updated_by = ? WHERE id = ?")
      .bind(JSON.stringify(schema), Date.now(), user.id, id)
      .run();
    await insertAudit({ actorId: user.id, action: "form.publish", entityType: "form", entityId: id });
  } else {
    await env.DB.prepare("UPDATE forms SET published = 0, updated_at = ?, updated_by = ? WHERE id = ?")
      .bind(Date.now(), user.id, id)
      .run();
    await insertAudit({ actorId: user.id, action: "form.unpublish", entityType: "form", entityId: id });
  }
  return { ok: true, published };
}

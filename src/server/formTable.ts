import { columnQuestions, type ColumnQuestion, type FormSchema } from "../shared/schema";
import { isColumnSlug, slugify } from "../shared/slug";
import { insertAudit } from "./audit";
import { env } from "./http";

const TABLE_RE = /^f_[0-9a-f]{32}$/;

export { slugify };

export function tableName(formId: string): string {
  const name = "f_" + formId.replace(/-/g, "").toLowerCase();
  if (!TABLE_RE.test(name)) throw new Error("bad form id");
  return name;
}

export function columnName(slug: string): string {
  if (!isColumnSlug(slug)) throw new Error("bad column slug");
  return slug;
}

function sqlType(q: ColumnQuestion): "TEXT" | "REAL" {
  return q.type === "number" ? "REAL" : "TEXT";
}

function ident(slug: string): string {
  return `"${columnName(slug)}"`;
}

export async function diffAndMigrate(opts: {
  formId: string;
  next: FormSchema;
  published: FormSchema | null;
  actorId: string;
}): Promise<void> {
  const table = tableName(opts.formId);
  const nextCols = columnQuestions(opts.next);
  const oldCols = opts.published ? columnQuestions(opts.published) : [];
  const oldIds = new Set(oldCols.map((q) => q.id));
  const statements: string[] = [];

  if (!opts.published) {
    const cols = nextCols.map((q) => `${ident(q.slug)} ${sqlType(q)}`).join(", ");
    const extra = cols ? ", " + cols : "";
    statements.push(`CREATE TABLE ${table} (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL${extra})`);
    statements.push(`CREATE INDEX ${table}_created_at ON ${table}(created_at)`);
    for (const q of nextCols) {
      if (q.type === "email" || q.type === "phone") statements.push(`CREATE INDEX ${table}_${columnName(q.slug)} ON ${table}(${ident(q.slug)})`);
    }
  } else {
    for (const q of nextCols) {
      if (oldIds.has(q.id)) continue;
      statements.push(`ALTER TABLE ${table} ADD COLUMN ${ident(q.slug)} ${sqlType(q)}`);
      if (q.type === "email" || q.type === "phone") {
        statements.push(`CREATE INDEX ${table}_${columnName(q.slug)} ON ${table}(${ident(q.slug)})`);
      }
    }
  }

  if (statements.length === 0) return;
  const sql = statements.join(";\n") + ";";
  await env.DB.exec(sql);
  await env.DB.prepare(
    "INSERT INTO form_migrations (id, form_id, sql, actor_id, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), opts.formId, sql, opts.actorId, Date.now())
    .run();
  await insertAudit({
    actorId: opts.actorId,
    action: "form.migrate",
    entityType: "form",
    entityId: opts.formId,
    meta: { statements: statements.length },
  });
}

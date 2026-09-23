import { columnQuestions, type ColumnQuestion, type FormSchema } from "../shared/schema";
import { isColumnSlug, slugify } from "../shared/slug";
import { insertAudit } from "./audit";
import { env } from "./http";

const TABLE_RE = /^f_[a-z][a-z0-9_]{0,44}_[0-9a-f]{8}$/;
const LEGACY_TABLE_RE = /^f_[0-9a-f]{32}$/;

export { slugify };

function titlePart(title: string): string {
  let base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  if (!base) base = "form";
  if (!/^[a-z]/.test(base)) base = "form_" + base;
  return base.slice(0, 44);
}

/** Per-form submissions table: f_{title_slug}_{id_prefix_8} */
export function tableName(formId: string, title: string): string {
  const idHex = formId.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(idHex)) throw new Error("bad form id");
  const hash = idHex.slice(0, 8);
  const name = `f_${titlePart(title)}_${hash}`;
  if (!TABLE_RE.test(name)) throw new Error("bad table name");
  return name;
}

export function legacyTableName(formId: string): string {
  const name = "f_" + formId.replace(/-/g, "").toLowerCase();
  if (!LEGACY_TABLE_RE.test(name)) throw new Error("bad form id");
  return name;
}

export function submissionsTableFromRow(row: {
  id: string;
  title: string;
  submissions_table?: string | null;
}): string {
  if (row.submissions_table) return row.submissions_table;
  return legacyTableName(row.id);
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
  table: string;
  next: FormSchema;
  published: FormSchema | null;
  actorId: string;
}): Promise<void> {
  const table = opts.table;
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

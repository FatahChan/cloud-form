const SLUG_RE = /^[a-z][a-z0-9_]{0,30}$/;

export const RESERVED = new Set([
  "id",
  "created_at",
  "rowid",
  "oid",
  "select",
  "index",
  "table",
  "from",
  "where",
  "group",
  "order",
  "limit",
  "join",
  "into",
  "values",
  "column",
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "create",
  "primary",
  "key",
  "unique",
  "check",
  "references",
  "foreign",
  "constraint",
  "trigger",
  "view",
  "pragma",
  "and",
  "or",
  "not",
  "null",
  "as",
  "on",
  "set",
  "by",
  "in",
  "is",
  "like",
  "between",
  "exists",
  "case",
  "when",
  "then",
  "else",
  "end",
  "union",
  "all",
  "distinct",
  "inner",
  "left",
  "right",
  "outer",
  "natural",
  "cross",
  "using",
  "default",
  "cast",
  "collate",
  "match",
  "regexp",
  "glob",
  "with",
  "recursive",
  "window",
  "filter",
  "over",
  "partition",
  "range",
  "rows",
  "groups",
  "unbounded",
  "preceding",
  "following",
  "current",
  "row",
  "returning",
  "generated",
  "always",
  "stored",
  "virtual",
  "strict",
]);

export function slugify(title: string, taken: Set<string>): string {
  let base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 31);
  // ponytail: non-latin titles strip to empty → generic "field", not the question type
  if (!base) base = "field";
  if (!/^[a-z]/.test(base)) base = "f_" + base;
  base = base.slice(0, 31);
  let candidate = base;
  let n = 2;
  while (RESERVED.has(candidate) || taken.has(candidate) || !SLUG_RE.test(candidate)) {
    const suffix = "_" + n;
    candidate = (base.slice(0, 31 - suffix.length) + suffix).slice(0, 31);
    n++;
    if (n > 99) throw new Error("could not slugify");
  }
  return candidate;
}

export function isColumnSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && !RESERVED.has(slug);
}

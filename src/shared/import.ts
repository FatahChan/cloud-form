import { parseAnswers } from "./answers";
import {
  liveQuestions,
  type Answers,
  type ColumnQuestion,
  type FormSchema,
  type Question,
} from "./schema";

export const IMPORT_MAX_ROWS = 2000;
export const IMPORT_ROW_ERROR_CAP = 25;

/** 1-based index among data rows only (spreadsheet row 1 is the header). */
export function importDataRowNumber(dataIndex: number): number {
  return dataIndex + 1;
}

/** Dummy upload id so parseAnswers can check required file fields without a real upload. */
const FILE_PLACEHOLDER = "00000000-0000-4000-8000-000000000000";

export type ColumnMapping = Record<string, string | null>;

export type ImportIssue = {
  kind:
    | "unmapped_required"
    | "unmapped_optional"
    | "duplicate_field"
    | "unknown_field"
    | "too_many_rows"
    | "no_rows"
    | "incompatible_column"
    | "row";
  message: string;
  questionId?: string;
  header?: string;
  row?: number;
};

export type ImportAnalysis = {
  blockers: ImportIssue[];
  warnings: ImportIssue[];
  ready: boolean;
};

export function importFields(schema: FormSchema): ColumnQuestion[] {
  return liveQuestions(schema).filter((q): q is ColumnQuestion => q.type !== "statement");
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function isHttpsFileUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" && !isBlockedImportHost(u.hostname);
  } catch {
    return false;
  }
}

/** ponytail: hostname blocklist only; upgrade path is DNS-resolve and reject private A/AAAA. */
export function isBlockedImportHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.+$/, "").replace(/^\[|\]$/g, "");
  if (h === "localhost" || h === "0.0.0.0" || h === "::1" || h === "::") return true;
  if (h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80:")) return true;
  return false;
}

export function suggestColumnMapping(headers: string[], schema: FormSchema): ColumnMapping {
  const fields = importFields(schema);
  const used = new Set<string>();
  const mapping: ColumnMapping = {};
  for (const header of headers) {
    mapping[header] = null;
    const key = norm(header);
    if (!key) continue;
    const match = fields.find((q) => !used.has(q.id) && (norm(q.slug) === key || norm(q.title) === key));
    if (!match) continue;
    mapping[header] = match.id;
    used.add(match.id);
  }
  return mapping;
}

function fieldSchema(q: ColumnQuestion): FormSchema {
  const question = { ...q, required: false } as Question;
  return {
    welcome: { title: "Import", button: "Go" },
    questions: [question],
    ending: { title: "Done" },
  };
}

function splitMulti(raw: string): string[] {
  return raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseImportCell(
  q: ColumnQuestion,
  raw: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  const t = raw.trim();
  if (!t) return { ok: true, value: undefined };
  if (q.type === "file") {
    if (!isHttpsFileUrl(t)) return { ok: false, error: `${q.title} must be an https:// link` };
    return { ok: true, value: t };
  }
  const body: Answers = {};
  if (q.type === "multi_select") body[q.id] = splitMulti(t);
  else body[q.id] = t;
  const parsed = parseAnswers(fieldSchema(q), body);
  if (!parsed.ok) return parsed;
  return { ok: true, value: parsed.data[q.id] };
}

function byId(schema: FormSchema): Map<string, ColumnQuestion> {
  return new Map(importFields(schema).map((q) => [q.id, q]));
}

export function rowToAnswers(schema: FormSchema, mapping: ColumnMapping, row: Record<string, string>): Answers {
  const fields = byId(schema);
  const out: Answers = {};
  for (const [header, questionId] of Object.entries(mapping)) {
    if (!questionId) continue;
    const q = fields.get(questionId);
    if (!q) continue;
    const raw = String(row[header] ?? "");
    const parsed = parseImportCell(q, raw);
    if (!parsed.ok || parsed.value === undefined) continue;
    out[q.id] = parsed.value;
  }
  return out;
}

export type PreparedImportRow = {
  answers: Answers;
  dropped: { questionId: string; title: string; error: string }[];
  requiredErrors: { questionId: string; title: string; error: string }[];
};

export function prepareImportRow(
  schema: FormSchema,
  mapping: ColumnMapping,
  row: Record<string, string>,
): PreparedImportRow {
  const fields = byId(schema);
  const answers: Answers = {};
  const dropped: PreparedImportRow["dropped"] = [];
  const requiredErrors: PreparedImportRow["requiredErrors"] = [];
  for (const [header, questionId] of Object.entries(mapping)) {
    if (!questionId) continue;
    const q = fields.get(questionId);
    if (!q) continue;
    const raw = String(row[header] ?? "");
    const parsed = parseImportCell(q, raw);
    if (parsed.ok) {
      if (parsed.value !== undefined) answers[q.id] = parsed.value;
      continue;
    }
    if (q.required) requiredErrors.push({ questionId: q.id, title: q.title, error: parsed.error });
    else dropped.push({ questionId: q.id, title: q.title, error: parsed.error });
  }
  return { answers, dropped, requiredErrors };
}

function answersForParse(schema: FormSchema, answers: Answers): Answers {
  const out: Answers = { ...answers };
  for (const q of importFields(schema)) {
    if (q.type !== "file") continue;
    const v = out[q.id];
    if (typeof v === "string" && isHttpsFileUrl(v)) out[q.id] = FILE_PLACEHOLDER;
  }
  return out;
}

function mappingIssues(schema: FormSchema, mapping: ColumnMapping): ImportIssue[] {
  const fields = byId(schema);
  const blockers: ImportIssue[] = [];
  const seen = new Map<string, string>();
  for (const [header, questionId] of Object.entries(mapping)) {
    if (!questionId) continue;
    const q = fields.get(questionId);
    if (!q) {
      blockers.push({
        kind: "unknown_field",
        message: `Column “${header}” maps to an unknown field`,
        header,
        questionId,
      });
      continue;
    }
    const prev = seen.get(questionId);
    if (prev) {
      blockers.push({
        kind: "duplicate_field",
        message: `“${q.title}” is mapped from both “${prev}” and “${header}”`,
        questionId,
        header,
      });
    } else {
      seen.set(questionId, header);
    }
  }
  for (const q of importFields(schema)) {
    if (!q.required) continue;
    if (seen.has(q.id)) continue;
    blockers.push({
      kind: "unmapped_required",
      message: `Required field “${q.title}” is not mapped`,
      questionId: q.id,
    });
  }
  return blockers;
}

function columnCompatibility(
  schema: FormSchema,
  mapping: ColumnMapping,
  rows: Record<string, string>[],
): { blockers: ImportIssue[]; warnings: ImportIssue[] } {
  const fields = byId(schema);
  const blockers: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  for (const [header, questionId] of Object.entries(mapping)) {
    if (!questionId) continue;
    const q = fields.get(questionId);
    if (!q) continue;
    let nonempty = 0;
    let bad = 0;
    for (const row of rows) {
      const raw = String(row[header] ?? "").trim();
      if (!raw) continue;
      nonempty += 1;
      if (!parseImportCell(q, raw).ok) bad += 1;
    }
    if (nonempty === 0 || bad === 0) continue;
    if (q.required && bad === nonempty) {
      blockers.push({
        kind: "incompatible_column",
        message:
          q.type === "file"
            ? `Column “${header}” is not compatible with an https:// file link for “${q.title}”`
            : `Column “${header}” is not compatible with “${q.title}”`,
        questionId: q.id,
        header,
      });
    } else if (!q.required) {
      warnings.push({
        kind: "row",
        message: `${bad} value${bad === 1 ? "" : "s"} in “${header}” will be skipped for optional “${q.title}”`,
        questionId: q.id,
        header,
      });
    }
  }
  return { blockers, warnings };
}

export function analyzeImport(schema: FormSchema, mapping: ColumnMapping, rows: Record<string, string>[]): ImportAnalysis {
  const blockers: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  if (rows.length > IMPORT_MAX_ROWS) {
    blockers.push({
      kind: "too_many_rows",
      message: `File has ${rows.length} rows; the limit is ${IMPORT_MAX_ROWS}`,
    });
  }
  if (rows.length === 0) {
    blockers.push({ kind: "no_rows", message: "File has no data rows" });
  }
  blockers.push(...mappingIssues(schema, mapping));
  const mapped = new Set(Object.values(mapping).filter((id): id is string => !!id));
  for (const q of importFields(schema)) {
    if (q.required || mapped.has(q.id)) continue;
    warnings.push({
      kind: "unmapped_optional",
      message: `Optional field “${q.title}” is not mapped`,
      questionId: q.id,
    });
  }
  const compat = columnCompatibility(schema, mapping, rows);
  blockers.push(...compat.blockers);
  warnings.push(...compat.warnings);

  let rowErrors = 0;
  const limit = Math.min(rows.length, IMPORT_MAX_ROWS);
  for (let i = 0; i < limit; i++) {
    const prepared = prepareImportRow(schema, mapping, rows[i]!);
    for (const err of prepared.requiredErrors) {
      rowErrors += 1;
      if (blockers.filter((b) => b.kind === "row").length < IMPORT_ROW_ERROR_CAP) {
        blockers.push({
          kind: "row",
          message: `Row ${importDataRowNumber(i)}: ${err.error}`,
          questionId: err.questionId,
          row: importDataRowNumber(i),
        });
      }
    }
    const parsed = parseAnswers(schema, answersForParse(schema, prepared.answers));
    if (!parsed.ok && prepared.requiredErrors.length === 0) {
      rowErrors += 1;
      if (blockers.filter((b) => b.kind === "row").length < IMPORT_ROW_ERROR_CAP) {
        blockers.push({
          kind: "row",
          message: `Row ${importDataRowNumber(i)}: ${parsed.error}`,
          row: importDataRowNumber(i),
        });
      }
    }
  }
  const shown = blockers.filter((b) => b.kind === "row").length;
  if (rowErrors > shown) {
    blockers.push({
      kind: "row",
      message: `And ${rowErrors - shown} more row error${rowErrors - shown === 1 ? "" : "s"}`,
    });
  }

  return { blockers, warnings, ready: blockers.length === 0 };
}

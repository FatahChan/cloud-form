import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { slugify } from "./slug";

export const FILE_KINDS = {
  jpg: { label: "JPEG", ext: [".jpg", ".jpeg"], mime: ["image/jpeg"] },
  png: { label: "PNG", ext: [".png"], mime: ["image/png"] },
  webp: { label: "WebP", ext: [".webp"], mime: ["image/webp"] },
  gif: { label: "GIF", ext: [".gif"], mime: ["image/gif"] },
  pdf: { label: "PDF", ext: [".pdf"], mime: ["application/pdf"] },
  txt: { label: "Text", ext: [".txt"], mime: ["text/plain"] },
  csv: { label: "CSV", ext: [".csv"], mime: ["text/csv", "text/plain"] },
  docx: {
    label: "Word",
    ext: [".docx"],
    mime: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  },
  xlsx: {
    label: "Excel",
    ext: [".xlsx"],
    mime: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  },
} as const;

export type FileKind = keyof typeof FILE_KINDS;
export const fileKindSchema = z.enum([
  "jpg",
  "png",
  "webp",
  "gif",
  "pdf",
  "txt",
  "csv",
  "docx",
  "xlsx",
]);

export const slugSchema = z.string().regex(/^[a-z][a-z0-9_]{0,30}$/);

const baseQ = {
  id: z.string().uuid(),
  title: z.string().max(200),
  description: z.string().max(2000).optional(),
  retired: z.boolean().optional(),
};

const textLike = z.object({
  ...baseQ,
  slug: slugSchema,
  required: z.boolean(),
  placeholder: z.string().max(80).optional(),
});

const shortTextRegexSchema = z
  .string()
  .max(200)
  .optional()
  .refine((s) => {
    if (!s) return true;
    try {
      new RegExp(s);
      return true;
    } catch {
      return false;
    }
  }, "Invalid regular expression");

export function shortTextMatchesRegex(pattern: string, value: string): boolean {
  try {
    return new RegExp(pattern).test(value);
  } catch {
    return false;
  }
}

export const questionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("statement"), ...baseQ }),
  textLike.extend({ type: z.literal("short_text"), regex: shortTextRegexSchema }),
  textLike.extend({ type: z.literal("long_text") }),
  textLike.extend({ type: z.literal("email") }),
  textLike.extend({ type: z.literal("phone") }),
  z.object({
    type: z.literal("number"),
    ...baseQ,
    slug: slugSchema,
    required: z.boolean(),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  z.object({
    type: z.literal("select"),
    ...baseQ,
    slug: slugSchema,
    required: z.boolean(),
    options: z.array(z.string().min(1).max(80)).min(2).max(26),
  }),
  z.object({
    type: z.literal("multi_select"),
    ...baseQ,
    slug: slugSchema,
    required: z.boolean(),
    options: z.array(z.string().min(1).max(80)).min(2).max(26),
  }),
  z.object({
    type: z.literal("date"),
    ...baseQ,
    slug: slugSchema,
    required: z.boolean(),
  }),
  z.object({
    type: z.literal("file"),
    ...baseQ,
    slug: slugSchema,
    required: z.boolean(),
    maxSizeMb: z.number().int().min(1).max(25),
    accept: z.array(fileKindSchema).min(1),
  }),
]);

export type Question = z.infer<typeof questionSchema>;
export type ColumnQuestion = Exclude<Question, { type: "statement" }>;

export const logicOpSchema = z.enum(["eq", "neq", "empty", "not_empty", "contains", "not_contains"]);
export type LogicOp = z.infer<typeof logicOpSchema>;

export const logicConditionSchema = z.object({
  questionId: z.string().uuid(),
  op: logicOpSchema,
  value: z.string().max(200).optional(),
});
export type LogicCondition = z.infer<typeof logicConditionSchema>;

export const pageRuleTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("page"), pageId: z.string().uuid() }),
  z.object({ kind: z.literal("ending") }),
]);
export type PageRuleTarget = z.infer<typeof pageRuleTargetSchema>;

export const pageRuleSchema = z.object({
  id: z.string().uuid(),
  conditions: z.array(logicConditionSchema).max(8),
  target: pageRuleTargetSchema,
});
export type PageRule = z.infer<typeof pageRuleSchema>;

export const pageRoutingSchema = z.object({
  rules: z.array(pageRuleSchema).max(20),
});
export type PageRouting = z.infer<typeof pageRoutingSchema>;

export const pageSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  questionIds: z.array(z.string().uuid()),
  routing: pageRoutingSchema.optional(),
});

export type FormPage = z.infer<typeof pageSchema>;

const flowPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type FlowPosition = z.infer<typeof flowPositionSchema>;

export const formSchema = z
  .object({
    welcome: z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
      button: z.string().min(1).max(40),
    }),
    questions: z.array(questionSchema).max(50),
    pages: z.array(pageSchema).optional(),
    ending: z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
    }),
    flowPositions: z.record(flowPositionSchema).optional(),
  })
  .refine((s) => {
    const slugs = s.questions.filter((q) => q.type !== "statement").map((q) => q.slug);
    return new Set(slugs).size === slugs.length;
  });

export type FormSchema = z.infer<typeof formSchema>;

export function newPage(questionIds: string[] = []): FormPage {
  return { id: crypto.randomUUID(), questionIds };
}

export function pageLabel(page: FormPage, index: number): string {
  return page.title?.trim() || `Page ${index + 1}`;
}

/** Move this page's questions onto the previous page (or the next, if this is first), then drop the page. */
export function removePage(schema: FormSchema, pageId: string): FormSchema {
  const n = normalizeFormSchema(schema);
  const idx = n.pages.findIndex((p) => p.id === pageId);
  if (idx < 0 || n.pages.length < 2) return n;
  const dest = n.pages[idx - 1] ?? n.pages[idx + 1];
  const gone = n.pages[idx];
  if (!dest || !gone || dest.id === gone.id) return n;
  const destIds = [...dest.questionIds, ...gone.questionIds];
  const pages = n.pages
    .filter((p) => p.id !== pageId)
    .map((p) => (p.id === dest.id ? { ...p, questionIds: destIds } : p));
  return normalizeFormSchema({ ...n, pages });
}

function cleanRouting(page: FormPage, pageIds: Set<string>, qIds: Set<string>): PageRouting | undefined {
  const rules = (page.routing?.rules ?? [])
    .map((rule) => {
      const conditions = rule.conditions.filter((c) => qIds.has(c.questionId));
      return { ...rule, conditions };
    })
    .filter((rule) => {
      if (rule.target.kind === "ending") return true;
      return pageIds.has(rule.target.pageId) && rule.target.pageId !== page.id;
    });
  return rules.length ? { rules } : undefined;
}

function cleanFlowPositions(schema: FormSchema, pageIds: Set<string>): FormSchema["flowPositions"] {
  const raw = schema.flowPositions;
  if (!raw) return undefined;
  const keep: Record<string, FlowPosition> = {};
  for (const [id, pos] of Object.entries(raw)) {
    if (id === "welcome" || id === "ending" || pageIds.has(id)) keep[id] = pos;
  }
  return Object.keys(keep).length ? keep : undefined;
}

export function pagesError(schema: { questions: Question[]; pages?: FormPage[] }): string | null {
  if (!schema.pages) return null;
  const qSet = new Set(schema.questions.map((q) => q.id));
  const seen = new Set<string>();
  for (const p of schema.pages) {
    for (const id of p.questionIds) {
      if (!qSet.has(id)) return "Unknown question on page";
      if (seen.has(id)) return "Question appears on more than one page";
      seen.add(id);
    }
  }
  return null;
}

export function normalizeFormSchema(schema: FormSchema): FormSchema & { pages: FormPage[] } {
  const qIds = schema.questions.map((q) => q.id);
  const qSet = new Set(qIds);
  const raw = schema.pages ?? [];
  if (raw.length === 0) {
    return { ...schema, pages: qIds.map((id) => newPage([id])), questions: schema.questions };
  }
  const seen = new Set<string>();
  const pages: FormPage[] = [];
  for (const p of raw) {
    const questionIds = p.questionIds.filter((id) => qSet.has(id) && !seen.has(id));
    for (const id of questionIds) seen.add(id);
    pages.push({
      id: p.id,
      title: p.title,
      description: p.description,
      questionIds,
      routing: p.routing,
    });
  }
  const missing = qIds.filter((id) => !seen.has(id));
  if (missing.length) {
    if (pages.length === 0) {
      for (const id of missing) pages.push(newPage([id]));
    } else {
      pages[pages.length - 1]!.questionIds.push(...missing);
    }
  }
  const pageIds = new Set(pages.map((p) => p.id));
  const qIdSet = new Set(qIds);
  for (const p of pages) {
    p.routing = cleanRouting(p, pageIds, qIdSet);
  }
  const byId = new Map(schema.questions.map((q) => [q.id, q]));
  const questions: Question[] = [];
  const used = new Set<string>();
  for (const p of pages) {
    for (const id of p.questionIds) {
      const q = byId.get(id);
      if (q && !used.has(id)) {
        questions.push(q);
        used.add(id);
      }
    }
  }
  for (const q of schema.questions) {
    if (!used.has(q.id)) questions.push(q);
  }
  return { ...schema, questions, pages, flowPositions: cleanFlowPositions(schema, pageIds) };
}

export function livePages(schema: FormSchema, includeRetired = false): FormPage[] {
  const n = normalizeFormSchema(schema);
  const keep = new Set(n.questions.filter((q) => includeRetired || !q.retired).map((q) => q.id));
  return n.pages
    .map((p) => ({ ...p, questionIds: p.questionIds.filter((id) => keep.has(id)) }))
    .filter((p) => p.questionIds.length > 0);
}

export function questionsOnPage(schema: FormSchema, page: FormPage): Question[] {
  const byId = new Map(schema.questions.map((q) => [q.id, q]));
  return page.questionIds.map((id) => byId.get(id)).filter((q): q is Question => !!q);
}

export function pageForQuestion(schema: FormSchema, questionId: string): FormPage | undefined {
  return normalizeFormSchema(schema).pages.find((p) => p.questionIds.includes(questionId));
}

export function columnQuestions(schema: FormSchema): ColumnQuestion[] {
  return schema.questions.filter((q): q is ColumnQuestion => q.type !== "statement");
}

export function liveQuestions(schema: FormSchema): Question[] {
  return schema.questions.filter((q) => !q.retired);
}

export function parseFormSchema(input: unknown): { ok: true; data: FormSchema } | { ok: false; error: string } {
  const r = formSchema.safeParse(input);
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? "Invalid schema" };
  const layout = pagesError(r.data);
  if (layout) return { ok: false, error: layout };
  return { ok: true, data: normalizeFormSchema(r.data) };
}

export function newQuestion(type: Question["type"], taken: Set<string>): Question {
  const id = crypto.randomUUID();
  if (type === "statement") return { type, id, title: "A note" };
  const title = "";
  const slug = slugify(title, taken);
  if (type === "select" || type === "multi_select") {
    return { type, id, slug, title, required: true, options: ["Option A", "Option B"] };
  }
  if (type === "file") {
    return { type, id, slug, title, required: true, maxSizeMb: 10, accept: ["jpg", "png", "pdf"] };
  }
  if (type === "number") return { type, id, slug, title, required: true };
  if (type === "date") return { type, id, slug, title, required: true };
  return { type, id, slug, title, required: true };
}

export function defaultFormSchema(): FormSchema {
  const id = crypto.randomUUID();
  return {
    welcome: { title: "Hello", button: "Start" },
    questions: [
      {
        type: "short_text",
        id,
        slug: "what_is_your_name",
        title: "What is your name?",
        required: true,
      },
    ],
    pages: [{ id: crypto.randomUUID(), questionIds: [id] }],
    ending: { title: "Thanks" },
  };
}

export function acceptAttr(kinds: FileKind[]): string {
  return kinds
    .flatMap((k) => [...FILE_KINDS[k].ext, ...FILE_KINDS[k].mime])
    .join(",");
}

export function fileKindFor(filename: string, mime: string): FileKind | null {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot >= 0 ? lower.slice(dot) : "";
  for (const kind of Object.keys(FILE_KINDS) as FileKind[]) {
    const spec = FILE_KINDS[kind];
    if (spec.ext.some((e) => e === ext) && spec.mime.some((m) => m === mime)) return kind;
  }
  return null;
}

export type Answers = Record<string, unknown>;

export function normalizePhone(raw: string): string | null {
  const parsed = parsePhoneNumberFromString(raw.trim());
  if (!parsed?.isValid()) return null;
  return parsed.number;
}

export function schemaEditError(_prev: FormSchema, next: FormSchema, published: FormSchema | null): string | null {
  const pubById = new Map((published?.questions ?? []).map((q) => [q.id, q]));
  for (const q of next.questions) {
    const pub = pubById.get(q.id);
    if (pub && pub.type !== "statement") {
      if (q.type !== pub.type) return "Question type cannot change after publish";
      if ("slug" in q && "slug" in pub && q.slug !== pub.slug) {
        return "Question slug cannot change";
      }
    }
  }
  return null;
}

export function publishSchemaError(schema: FormSchema): string | null {
  if (schema.questions.some((q) => !q.title.trim())) return "Every question needs a title";
  return null;
}

export type SchemaDiff = {
  lines: string[];
  questionIds: Set<string>;
  welcome: boolean;
  ending: boolean;
  pages: boolean;
};

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function questionChangeLine(old: Question, next: Question): string | null {
  if (sameJson(old, next)) return null;
  if (!old.retired && next.retired) return `Retired “${next.title}”`;
  if (old.retired && !next.retired) return `Unretired “${next.title}”`;
  if (old.title !== next.title) return `Renamed “${old.title}” → “${next.title}”`;
  return `Updated “${next.title}”`;
}

function pageLayoutKey(schema: FormSchema): string {
  return normalizeFormSchema(schema)
    .pages.map((p) => p.questionIds.join(","))
    .join("|");
}

function routingKey(schema: FormSchema): string {
  return JSON.stringify(
    normalizeFormSchema(schema).pages.map((p) => p.routing ?? null),
  );
}

export function unpublishedChanges(draft: FormSchema, published: FormSchema | null): SchemaDiff {
  if (!published) {
    return { lines: [], questionIds: new Set(), welcome: false, ending: false, pages: false };
  }
  const lines: string[] = [];
  const questionIds = new Set<string>();
  const welcome = !sameJson(draft.welcome, published.welcome);
  const ending = !sameJson(draft.ending, published.ending);
  if (welcome) lines.push("Welcome screen");
  if (ending) lines.push("Ending screen");
  const pages = pageLayoutKey(draft) !== pageLayoutKey(published);
  const pageCopyChanged = !sameJson(
    normalizeFormSchema(draft).pages.map((p) => ({ title: p.title, description: p.description })),
    normalizeFormSchema(published).pages.map((p) => ({ title: p.title, description: p.description })),
  );
  const routingChanged = routingKey(draft) !== routingKey(published);
  if (pages || pageCopyChanged) lines.push("Page layout");
  if (routingChanged) lines.push("Page logic");
  const pubById = new Map(published.questions.map((q) => [q.id, q]));
  const draftIds = new Set(draft.questions.map((q) => q.id));
  for (const q of published.questions) {
    if (draftIds.has(q.id)) continue;
    lines.push(`Removed “${q.title}”`);
    questionIds.add(q.id);
  }
  for (const q of draft.questions) {
    const old = pubById.get(q.id);
    if (!old) {
      lines.push(`Added “${q.title}”`);
      questionIds.add(q.id);
      continue;
    }
    const line = questionChangeLine(old, q);
    if (!line) continue;
    lines.push(line);
    questionIds.add(q.id);
  }
  const remaining = published.questions.filter((q) => draftIds.has(q.id)).map((q) => q.id);
  const draftOrder = draft.questions.filter((q) => pubById.has(q.id)).map((q) => q.id);
  if (!pages && remaining.join() !== draftOrder.join()) lines.push("Question order");
  return { lines, questionIds, welcome, ending, pages: pages || pageCopyChanged || routingChanged };
}

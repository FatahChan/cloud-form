// zod/v4 (bundled with zod 3.25) only for its toJSONSchema; the built FormSchema is still checked by the v3 schema.
import { z } from "zod/v4";
import { slugify } from "./slug";
import { fileKindSchema, parseFormSchema, type FormSchema, type Question } from "./schema";

export const FORM_SPEC_SCHEMA_PATH = "/api/public/form-spec-schema";

// Hand-authored form JSON: ids and slugs are generated, never pasted.
// ponytail: no page routing in specs; add logic in the builder after creating. Upgrade path: reference pages by index.
// ponytail: regex validity isn't checked here; the final parseFormSchema reports it (without a path).
const title = z.string().trim().min(1, "Title is required").max(200);
const description = z.string().max(2000).optional();
const required = z.boolean().default(true);
const placeholder = z.string().max(80).optional();

const specQuestionSchema = z.discriminatedUnion(
  "type",
  [
    z.strictObject({ type: z.literal("statement"), title, description }),
    z.strictObject({
      type: z.literal("short_text"),
      title,
      description,
      required,
      placeholder,
      regex: z.string().max(200).optional(),
    }),
    z.strictObject({ type: z.enum(["long_text", "email", "phone"]), title, description, required, placeholder }),
    z.strictObject({
      type: z.literal("number"),
      title,
      description,
      required,
      min: z.number().optional(),
      max: z.number().optional(),
    }),
    z.strictObject({
      type: z.enum(["select", "multi_select"]),
      title,
      description,
      required,
      options: z.array(z.string().trim().min(1).max(80)).min(2).max(26),
    }),
    z.strictObject({ type: z.literal("date"), title, description, required }),
    z.strictObject({
      type: z.literal("file"),
      title,
      description,
      required,
      maxSizeMb: z.number().int().min(1).max(25).default(10),
      accept: z.array(z.enum(fileKindSchema.options)).min(1).default(["pdf", "jpg", "png"]),
    }),
  ],
  {
    error: (iss) =>
      iss.code === "invalid_union"
        ? "Unknown question type. Use one of: statement, short_text, long_text, email, phone, number, select, multi_select, date, file"
        : undefined,
  },
);

export const formSpecSchema = z
  .strictObject({
    $schema: z.string().optional(),
    title,
    welcome: z.strictObject({ title, description, button: z.string().trim().min(1).max(40).default("Start") }).optional(),
    pages: z
      .array(z.strictObject({ title: z.string().max(200).optional(), description, questions: z.array(specQuestionSchema).min(1) }))
      .min(1),
    ending: z.strictObject({ title, description }).optional(),
  })
  .refine((s) => s.pages.reduce((n, p) => n + p.questions.length, 0) <= 50, {
    message: "A form can have at most 50 questions",
    path: ["pages"],
  });

export type FormSpec = z.infer<typeof formSpecSchema>;

export function formSpecJsonSchema() {
  return z.toJSONSchema(formSpecSchema, { io: "input", target: "draft-7" });
}

export const FORM_SPEC_EXAMPLE = {
  title: "Event registration",
  welcome: { title: "Register for the event", description: "Takes about two minutes.", button: "Start" },
  pages: [
    {
      title: "About you",
      questions: [
        { type: "short_text", title: "Full name", placeholder: "Jane Doe" },
        { type: "email", title: "Email" },
        { type: "phone", title: "Phone", required: false },
      ],
    },
    {
      title: "Your ticket",
      description: "Pick what fits you best.",
      questions: [
        { type: "select", title: "Ticket type", options: ["General", "VIP", "Student"] },
        { type: "multi_select", title: "Workshops", options: ["Design", "Engineering", "Product"], required: false },
        { type: "number", title: "Extra guests", min: 0, max: 5 },
        { type: "date", title: "Arrival date" },
        { type: "file", title: "Student ID", accept: ["pdf", "jpg", "png"], maxSizeMb: 5, required: false },
        { type: "long_text", title: "Anything else we should know?", required: false },
        { type: "statement", title: "We'll email your ticket after you submit." },
      ],
    },
  ],
  ending: { title: "You're registered!", description: "See you there." },
} satisfies z.input<typeof formSpecSchema>;

function issuePath(path: PropertyKey[]): string {
  return path.map((p) => (typeof p === "number" ? `[${p}]` : `.${String(p)}`)).join("").replace(/^\./, "");
}

function formFromSpec(spec: FormSpec): FormSchema {
  const taken = new Set<string>();
  const questions: Question[] = [];
  const pages = spec.pages.map((p) => ({
    id: crypto.randomUUID(),
    title: p.title,
    description: p.description,
    questionIds: p.questions.map((sq) => {
      const id = crypto.randomUUID();
      if (sq.type === "statement") {
        questions.push({ ...sq, id });
      } else {
        const slug = slugify(sq.title, taken);
        taken.add(slug);
        questions.push({ ...sq, id, slug });
      }
      return id;
    }),
  }));
  return {
    welcome: spec.welcome ?? { title: spec.title, button: "Start" },
    questions,
    pages,
    ending: spec.ending ?? { title: "Thanks!" },
  };
}

export function parseFormSpec(
  text: string,
): { ok: true; title: string; schema: FormSchema } | { ok: false; errors: string[] } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`] };
  }
  const spec = formSpecSchema.safeParse(json);
  if (!spec.success) {
    return {
      ok: false,
      errors: spec.error.issues.map((i) => (i.path.length ? `${issuePath(i.path)}: ${i.message}` : i.message)),
    };
  }
  const parsed = parseFormSchema(formFromSpec(spec.data));
  if (!parsed.ok) return { ok: false, errors: [parsed.error] };
  return { ok: true, title: spec.data.title, schema: parsed.data };
}

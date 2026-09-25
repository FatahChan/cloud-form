import { z } from "zod";
import { questionsOnPath } from "./flow";
import {
  liveQuestions,
  normalizePhone,
  shortTextMatchesRegex,
  type Answers,
  type FormSchema,
} from "./schema";

export function parseAnswers(
  schema: FormSchema,
  body: unknown,
): { ok: true; data: Answers } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "answers must be an object" };
  }
  const raw = body as Record<string, unknown>;
  const out: Answers = {};
  for (const q of liveQuestions(schema)) {
    if (q.type === "statement") continue;
    const v = raw[q.id];
    if (v === undefined || v === null || v === "") {
      continue;
    }
    switch (q.type) {
      case "short_text": {
        if (typeof v !== "string") return { ok: false, error: `${q.title} must be text` };
        const t = v.trim();
        if (!t) break;
        if (q.regex && !shortTextMatchesRegex(q.regex, t)) {
          return { ok: false, error: `${q.title} does not match the required format` };
        }
        out[q.id] = t;
        break;
      }
      case "long_text": {
        if (typeof v !== "string") return { ok: false, error: `${q.title} must be text` };
        const t = v.trim();
        if (t) out[q.id] = t;
        break;
      }
      case "email": {
        if (typeof v !== "string") return { ok: false, error: `${q.title} must be an email` };
        const t = v.trim().toLowerCase();
        const er = z.string().email().safeParse(t);
        if (!er.success) return { ok: false, error: `${q.title} must be an email` };
        out[q.id] = t;
        break;
      }
      case "phone": {
        if (typeof v !== "string") return { ok: false, error: `${q.title} must be a phone number` };
        const t = normalizePhone(v);
        if (!t) return { ok: false, error: `${q.title} must be a phone number` };
        out[q.id] = t;
        break;
      }
      case "number": {
        const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
        if (!Number.isFinite(n)) return { ok: false, error: `${q.title} must be a number` };
        if (q.min !== undefined && n < q.min) return { ok: false, error: `${q.title} is too small` };
        if (q.max !== undefined && n > q.max) return { ok: false, error: `${q.title} is too large` };
        out[q.id] = n;
        break;
      }
      case "date": {
        if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
          return { ok: false, error: `${q.title} must be a date` };
        }
        out[q.id] = v;
        break;
      }
      case "select":
      case "dropdown": {
        if (typeof v !== "string" || !q.options.includes(v)) {
          return { ok: false, error: `${q.title} is not a valid choice` };
        }
        out[q.id] = v;
        break;
      }
      case "multi_select": {
        if (!Array.isArray(v) || v.some((x) => typeof x !== "string" || !q.options.includes(x))) {
          return { ok: false, error: `${q.title} has invalid choices` };
        }
        if (v.length === 0) break;
        out[q.id] = v;
        break;
      }
      case "file": {
        const uploadId =
          typeof v === "object" && v && "uploadId" in v && typeof (v as { uploadId: unknown }).uploadId === "string"
            ? (v as { uploadId: string }).uploadId
            : typeof v === "string"
              ? v
              : null;
        if (!uploadId || !z.string().uuid().safeParse(uploadId).success) {
          return { ok: false, error: `${q.title} needs a file` };
        }
        out[q.id] = { uploadId };
        break;
      }
    }
  }
  const onPath = questionsOnPath(schema, out);
  for (const q of liveQuestions(schema)) {
    if (q.type === "statement" || !("required" in q) || !q.required) continue;
    if (!onPath.has(q.id)) continue;
    const v = out[q.id];
    if (v === undefined || v === null || v === "") return { ok: false, error: `Missing ${q.title}` };
    if (q.type === "multi_select" && Array.isArray(v) && v.length === 0) {
      return { ok: false, error: `Missing ${q.title}` };
    }
  }
  return { ok: true, data: out };
}

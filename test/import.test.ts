import { describe, expect, it } from "vitest";
import {
  analyzeImport,
  IMPORT_MAX_ROWS,
  isHttpsFileUrl,
  prepareImportRow,
  rowToAnswers,
  suggestColumnMapping,
  type ColumnMapping,
} from "../src/shared/import";
import type { FormSchema } from "../src/shared/schema";

const EMAIL = "11111111-1111-4111-8111-111111111111";
const NAME = "22222222-2222-4222-8222-222222222222";
const COLOR = "33333333-3333-4333-8333-333333333333";
const TAGS = "44444444-4444-4444-8444-444444444444";
const WHEN = "55555555-5555-4555-8555-555555555555";
const NOTE = "66666666-6666-4666-8666-666666666666";
const CV = "77777777-7777-4777-8777-777777777777";

function schema(extra: Partial<FormSchema> = {}): FormSchema {
  return {
    welcome: { title: "Hi", button: "Go" },
    questions: [
      { type: "email", id: EMAIL, slug: "email", title: "Work email", required: true },
      { type: "short_text", id: NAME, slug: "name", title: "Full name", required: true },
      {
        type: "select",
        id: COLOR,
        slug: "color",
        title: "Favorite color",
        required: true,
        options: ["Red", "Blue"],
      },
      {
        type: "multi_select",
        id: TAGS,
        slug: "tags",
        title: "Tags",
        required: false,
        options: ["A", "B", "C"],
      },
      { type: "date", id: WHEN, slug: "when", title: "Date", required: false },
      { type: "long_text", id: NOTE, slug: "note", title: "Notes", required: false },
    ],
    ending: { title: "Bye" },
    ...extra,
  };
}

describe("suggestColumnMapping", () => {
  it("matches slug and title, case-insensitive", () => {
    const mapping = suggestColumnMapping(["EMAIL", "Full Name", "unknown"], schema());
    expect(mapping.EMAIL).toBe(EMAIL);
    expect(mapping["Full Name"]).toBe(NAME);
    expect(mapping.unknown).toBeNull();
  });

  it("does not map the same field twice", () => {
    const mapping = suggestColumnMapping(["email", "Work email"], schema());
    expect(mapping.email).toBe(EMAIL);
    expect(mapping["Work email"]).toBeNull();
  });
});

describe("rowToAnswers", () => {
  it("splits multi_select on semicolons", () => {
    const mapping: ColumnMapping = { tags: TAGS };
    const answers = rowToAnswers(schema(), mapping, { tags: "A; B" });
    expect(answers[TAGS]).toEqual(["A", "B"]);
  });
});

describe("analyzeImport", () => {
  const mapping: ColumnMapping = {
    email: EMAIL,
    name: NAME,
    color: COLOR,
    tags: TAGS,
    when: WHEN,
  };

  it("blocks when a required field is unmapped", () => {
    const r = analyzeImport(schema(), { email: EMAIL, name: NAME }, [{ email: "a@x.com", name: "Ada" }]);
    expect(r.ready).toBe(false);
    expect(r.blockers.some((b) => b.kind === "unmapped_required" && b.questionId === COLOR)).toBe(true);
  });

  it("allows unmapped optional fields", () => {
    const r = analyzeImport(
      schema(),
      { email: EMAIL, name: NAME, color: COLOR },
      [{ email: "ada@x.com", name: "Ada", color: "Red" }],
    );
    expect(r.ready).toBe(true);
    expect(r.warnings.some((w) => w.questionId === NOTE)).toBe(true);
  });

  it("blocks bad emails and invalid select options", () => {
    const r = analyzeImport(schema(), mapping, [
      { email: "not-an-email", name: "Ada", color: "Red" },
      { email: "ada@x.com", name: "Ada", color: "Green" },
    ]);
    expect(r.ready).toBe(false);
    expect(r.blockers.some((b) => b.message.includes("email"))).toBe(true);
    expect(r.blockers.some((b) => b.message.includes("choice") || b.message.includes("Green"))).toBe(true);
  });

  it("blocks invalid dates on required-mapped optional only as warning when optional", () => {
    const r = analyzeImport(schema(), mapping, [
      { email: "ada@x.com", name: "Ada", color: "Red", when: "not-a-date" },
    ]);
    expect(r.ready).toBe(true);
    expect(r.warnings.some((w) => w.questionId === WHEN)).toBe(true);
    const prepared = prepareImportRow(schema(), mapping, {
      email: "ada@x.com",
      name: "Ada",
      color: "Red",
      when: "not-a-date",
    });
    expect(prepared.answers[WHEN]).toBeUndefined();
  });

  it("blocks when every value in a required column is the wrong type", () => {
    const r = analyzeImport(schema(), mapping, [
      { email: "nope", name: "Ada", color: "Red" },
      { email: "also-no", name: "Bob", color: "Blue" },
    ]);
    expect(r.blockers.some((b) => b.kind === "incompatible_column")).toBe(true);
  });

  it("is ready for a valid file including multi_select", () => {
    const r = analyzeImport(schema(), mapping, [
      { email: "ada@x.com", name: "Ada", color: "Red", tags: "A;C", when: "2024-01-15" },
    ]);
    expect(r.ready).toBe(true);
  });

  it("requires https file links", () => {
    expect(isHttpsFileUrl("https://files.example.com/cv.pdf")).toBe(true);
    expect(isHttpsFileUrl("http://files.example.com/cv.pdf")).toBe(false);
    expect(isHttpsFileUrl("https://127.0.0.1/cv.pdf")).toBe(false);
    expect(isHttpsFileUrl("https://10.0.0.5/cv.pdf")).toBe(false);
    const withFile: FormSchema = {
      ...schema(),
      questions: [
        ...schema().questions,
        { type: "file", id: CV, slug: "cv", title: "CV", required: true, maxSizeMb: 5, accept: ["pdf"] },
      ],
    };
    const r = analyzeImport(
      withFile,
      { ...mapping, cv: CV },
      [{ email: "ada@x.com", name: "Ada", color: "Red", cv: "ftp://x/cv.pdf" }],
    );
    expect(r.ready).toBe(false);
    expect(r.blockers.some((b) => b.message.toLowerCase().includes("https"))).toBe(true);
  });

  it("blocks oversized files", () => {
    const r = analyzeImport(schema(), mapping, Array.from({ length: IMPORT_MAX_ROWS + 1 }, () => ({
      email: "ada@x.com",
      name: "Ada",
      color: "Red",
    })));
    expect(r.ready).toBe(false);
    expect(r.blockers.some((b) => b.kind === "too_many_rows")).toBe(true);
  });
});

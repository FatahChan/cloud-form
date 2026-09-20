import { describe, expect, it } from "vitest";
import {
  normalizeFormSchema,
  parseFormSchema,
  unpublishedChanges,
  type FormSchema,
} from "../src/shared/schema";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PAGE = "11111111-1111-4111-8111-111111111111";
const PAGE2 = "22222222-2222-4222-8222-222222222222";

const base: FormSchema = {
  welcome: { title: "Hi", button: "Go" },
  questions: [
    { type: "short_text", id: A, slug: "a", title: "A", required: true },
    { type: "email", id: B, slug: "b", title: "B", required: true },
  ],
  ending: { title: "Bye" },
};

describe("normalizeFormSchema", () => {
  it("builds one page per question when pages are missing", () => {
    const n = normalizeFormSchema(base);
    expect(n.pages).toHaveLength(2);
    expect(n.pages?.[0]?.questionIds).toEqual([A]);
    expect(n.pages?.[1]?.questionIds).toEqual([B]);
  });

  it("appends missing questions to the last page", () => {
    const n = normalizeFormSchema({
      ...base,
      pages: [{ id: PAGE, questionIds: [A] }],
    });
    expect(n.pages).toHaveLength(1);
    expect(n.pages?.[0]?.questionIds).toEqual([A, B]);
  });

  it("drops unknown ids and keeps grouping", () => {
    const n = normalizeFormSchema({
      ...base,
      pages: [{ id: PAGE, title: "Together", questionIds: [A, B, "cccccccc-cccc-4ccc-8ccc-cccccccccccc"] }],
    });
    expect(n.pages?.[0]).toMatchObject({ title: "Together", questionIds: [A, B] });
  });
});

describe("parseFormSchema pages", () => {
  it("rejects a question on two pages", () => {
    const r = parseFormSchema({
      ...base,
      pages: [
        { id: PAGE, questionIds: [A] },
        { id: PAGE2, questionIds: [A] },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/more than one page/);
  });

  it("rejects an unknown question id", () => {
    const r = parseFormSchema({
      ...base,
      pages: [{ id: PAGE, questionIds: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"] }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Unknown question/);
  });

  it("accepts two fields on one page", () => {
    const r = parseFormSchema({
      ...base,
      pages: [{ id: PAGE, title: "Contact", questionIds: [A, B] }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.pages).toEqual([{ id: PAGE, title: "Contact", questionIds: [A, B] }]);
  });
});

describe("unpublishedChanges pages", () => {
  it("flags page layout when fields share a page", () => {
    const grouped: FormSchema = {
      ...base,
      pages: [{ id: PAGE, questionIds: [A, B] }],
    };
    const d = unpublishedChanges(grouped, base);
    expect(d.pages).toBe(true);
    expect(d.lines).toContain("Page layout");
  });
});

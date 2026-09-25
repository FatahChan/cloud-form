import { describe, expect, it } from "vitest";
import { FORM_SPEC_EXAMPLE, formSpecJsonSchema, parseFormSpec } from "../src/shared/form-spec";

describe("form spec", () => {
  it("builds a valid form from the example", () => {
    const r = parseFormSpec(JSON.stringify(FORM_SPEC_EXAMPLE));
    if (!r.ok) throw new Error(r.errors.join("\n"));
    expect(r.title).toBe("Event registration");
    expect(r.schema.pages?.map((p) => p.questionIds.length)).toEqual([3, 7]);
    const slugs = r.schema.questions.flatMap((q) => ("slug" in q ? [q.slug] : []));
    expect(new Set(slugs).size).toBe(9);
    expect(r.schema.questions.find((q) => q.type === "phone")).toMatchObject({ required: false });
    expect(r.schema.questions.find((q) => q.type === "email")).toMatchObject({ required: true });
  });

  it("dedupes slugs and fills defaults", () => {
    const r = parseFormSpec(
      JSON.stringify({ title: "T", pages: [{ questions: [{ type: "file", title: "Name" }, { type: "email", title: "Name" }] }] }),
    );
    if (!r.ok) throw new Error(r.errors.join("\n"));
    expect(r.schema.questions.map((q) => ("slug" in q ? q.slug : null))).toEqual(["name", "name_2"]);
    expect(r.schema.questions[0]).toMatchObject({ maxSizeMb: 10, accept: ["pdf", "jpg", "png"] });
    expect(r.schema.welcome).toEqual({ title: "T", button: "Start" });
  });

  it("reports errors with a path", () => {
    expect(parseFormSpec("{ nope")).toMatchObject({ ok: false });
    const bad = parseFormSpec(
      JSON.stringify({ title: "T", pages: [{ questions: [{ type: "select", title: "Pick", options: ["only"], slug: "x" }] }] }),
    );
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.errors.some((e) => e.startsWith("pages[0].questions[0].options:"))).toBe(true);
    expect(bad.errors.some((e) => e.includes("slug"))).toBe(true);
    const unknown = parseFormSpec(JSON.stringify({ title: "T", pages: [{ questions: [{ type: "rating", title: "R" }] }] }));
    expect(unknown).toMatchObject({ ok: false, errors: [expect.stringMatching(/^pages\[0\]\.questions\[0\]\.type: Unknown question type/)] });
  });

  it("exports a JSON Schema for editors and accepts $schema", () => {
    const js = formSpecJsonSchema() as { $schema: string; additionalProperties: boolean; required: string[] };
    expect(js.$schema).toBe("http://json-schema.org/draft-07/schema#");
    expect(js.additionalProperties).toBe(false);
    expect(js.required).toEqual(["title", "pages"]);
    expect(JSON.stringify(js)).toContain('"multi_select"');
    expect(parseFormSpec(JSON.stringify({ $schema: "https://example.com/s", ...FORM_SPEC_EXAMPLE })).ok).toBe(true);
  });
});

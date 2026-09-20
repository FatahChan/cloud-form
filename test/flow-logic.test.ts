import { describe, expect, it } from "vitest";
import { parseAnswers } from "../src/shared/answers";
import {
  defaultPageOrder,
  questionsOnPath,
  resolveNext,
  routingError,
  simulatePath,
  unreachablePages,
} from "../src/shared/flow";
import { unpublishedChanges, removePage, type FormSchema } from "../src/shared/schema";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const P3 = "33333333-3333-4333-8333-333333333333";
const Q_GENDER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const Q_MARRIED = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const Q_JOB = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const RULE_F = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const RULE_ALWAYS = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function schema(): FormSchema {
  return {
    welcome: { title: "Hi", button: "Start" },
    questions: [
      {
        type: "select",
        id: Q_GENDER,
        slug: "gender",
        title: "Gender",
        required: true,
        options: ["Female", "Male"],
      },
      {
        type: "select",
        id: Q_MARRIED,
        slug: "married",
        title: "Married?",
        required: true,
        options: ["Yes", "No"],
      },
      {
        type: "short_text",
        id: Q_JOB,
        slug: "job",
        title: "Job title",
        required: true,
      },
    ],
    pages: [
      {
        id: P1,
        title: "About you",
        questionIds: [Q_GENDER],
        routing: {
          rules: [
            {
              id: RULE_F,
              conditions: [{ questionId: Q_GENDER, op: "eq", value: "Female" }],
              target: { kind: "page", pageId: P2 },
            },
          ],
        },
      },
      { id: P2, title: "Family", questionIds: [Q_MARRIED] },
      { id: P3, title: "Work", questionIds: [Q_JOB] },
    ],
    ending: { title: "Thanks" },
  };
}

describe("flow engine", () => {
  it("follows default order when no rule matches", () => {
    const s = schema();
    expect(defaultPageOrder(s).map((p) => p.id)).toEqual([P1, P2, P3]);
    expect(resolveNext(s, P1, { [Q_GENDER]: "Male" })).toEqual({ kind: "page", pageId: P2 });
    expect(resolveNext(s, P3, {})).toEqual({ kind: "ending" });
  });

  it("first matching rule wins over default next", () => {
    const s = schema();
    expect(resolveNext(s, P1, { [Q_GENDER]: "Female" })).toEqual({ kind: "page", pageId: P2 });
  });

  it("AND conditions must all match", () => {
    const s = schema();
    s.pages![0]!.routing = {
      rules: [
        {
          id: RULE_F,
          conditions: [
            { questionId: Q_GENDER, op: "eq", value: "Female" },
            { questionId: Q_GENDER, op: "neq", value: "Male" },
          ],
          target: { kind: "ending" },
        },
      ],
    };
    expect(resolveNext(s, P1, { [Q_GENDER]: "Female" })).toEqual({ kind: "ending" });
    expect(resolveNext(s, P1, { [Q_GENDER]: "Male" })).toEqual({ kind: "page", pageId: P2 });
  });

  it("simulatePath and questionsOnPath skip the unused branch", () => {
    const s = schema();
    s.pages![0]!.routing!.rules.push({
      id: RULE_ALWAYS,
      conditions: [{ questionId: Q_GENDER, op: "eq", value: "Male" }],
      target: { kind: "page", pageId: P3 },
    });
    const female = simulatePath(s, { [Q_GENDER]: "Female" });
    expect(female).toEqual([P1, P2, P3]);
    const male = simulatePath(s, { [Q_GENDER]: "Male" });
    expect(male).toEqual([P1, P3]);
    expect([...questionsOnPath(s, { [Q_GENDER]: "Male" })].sort()).toEqual([Q_GENDER, Q_JOB].sort());
  });

  it("parseAnswers does not require skipped pages", () => {
    const s = schema();
    s.pages![0]!.routing!.rules.push({
      id: RULE_ALWAYS,
      conditions: [{ questionId: Q_GENDER, op: "eq", value: "Male" }],
      target: { kind: "page", pageId: P3 },
    });
    const skipped = parseAnswers(s, { [Q_GENDER]: "Male", [Q_JOB]: "Engineer" });
    expect(skipped).toEqual({ ok: true, data: { [Q_GENDER]: "Male", [Q_JOB]: "Engineer" } });
    const missingOnPath = parseAnswers(s, { [Q_GENDER]: "Female" });
    expect(missingOnPath.ok).toBe(false);
  });

  it("flags forward-looking logic", () => {
    const s = schema();
    s.pages![0]!.routing = {
      rules: [
        {
          id: RULE_F,
          conditions: [{ questionId: Q_MARRIED, op: "eq", value: "Yes" }],
          target: { kind: "ending" },
        },
      ],
    };
    expect(routingError(s)).toMatch(/earlier/);
  });

  it("reports unreachable pages when an always-rule skips the rest", () => {
    const s = schema();
    s.pages![0]!.routing = {
      rules: [
        {
          id: RULE_ALWAYS,
          conditions: [],
          target: { kind: "ending" },
        },
      ],
    };
    expect(unreachablePages(s).map((p) => p.id)).toEqual([P2, P3]);
  });

  it("unpublishedChanges flags page logic", () => {
    const published = schema();
    const draft = schema();
    draft.pages![0]!.routing = {
      rules: [
        {
          id: RULE_ALWAYS,
          conditions: [],
          target: { kind: "ending" },
        },
      ],
    };
    const d = unpublishedChanges(draft, published);
    expect(d.lines).toContain("Page logic");
    expect(d.pages).toBe(true);
  });

  it("removePage moves questions onto the previous page", () => {
    const next = removePage(schema(), P2);
    expect(next.pages.map((p) => p.id)).toEqual([P1, P3]);
    expect(next.pages[0]?.questionIds).toEqual([Q_GENDER, Q_MARRIED]);
    expect(next.pages[1]?.questionIds).toEqual([Q_JOB]);
  });
});

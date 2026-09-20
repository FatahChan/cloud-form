import {
  livePages,
  normalizeFormSchema,
  pageLabel,
  type Answers,
  type FormPage,
  type FormSchema,
  type LogicCondition,
  type PageRule,
  type Question,
} from "./schema";

export const FLOW_WELCOME = "welcome";
export const FLOW_ENDING = "ending";
export const MAX_FLOW_STEPS = 100;

export type FlowTarget = { kind: "page"; pageId: string } | { kind: "ending" };

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function asStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === "string");
  if (typeof value === "string") return [value];
  if (typeof value === "number" && Number.isFinite(value)) return [String(value)];
  return [];
}

export function conditionMatches(condition: LogicCondition, answers: Answers): boolean {
  const raw = answers[condition.questionId];
  const texts = asStrings(raw);
  switch (condition.op) {
    case "empty":
      return isEmpty(raw);
    case "not_empty":
      return !isEmpty(raw);
    case "eq":
      return condition.value !== undefined && texts.length === 1 && texts[0] === condition.value;
    case "neq":
      return condition.value !== undefined && !(texts.length === 1 && texts[0] === condition.value);
    case "contains":
      if (condition.value === undefined) return false;
      if (Array.isArray(raw)) return raw.includes(condition.value);
      return texts.some((s) => s.includes(condition.value!));
    case "not_contains":
      if (condition.value === undefined) return false;
      if (Array.isArray(raw)) return !raw.includes(condition.value);
      return !texts.some((s) => s.includes(condition.value!));
  }
}

function ruleMatches(rule: PageRule, answers: Answers): boolean {
  if (!rule.conditions.length) return true;
  return rule.conditions.every((c) => conditionMatches(c, answers));
}

export function defaultPageOrder(schema: FormSchema): FormPage[] {
  return livePages(schema);
}

export function resolveNext(schema: FormSchema, currentPageId: string, answers: Answers): FlowTarget {
  const n = normalizeFormSchema(schema);
  const walk = livePages(n);
  const current = walk.find((p) => p.id === currentPageId) ?? n.pages.find((p) => p.id === currentPageId);
  if (!current) return { kind: "ending" };
  const liveIds = new Set(walk.map((p) => p.id));
  for (const rule of current.routing?.rules ?? []) {
    if (!ruleMatches(rule, answers)) continue;
    if (rule.target.kind === "ending") return { kind: "ending" };
    if (liveIds.has(rule.target.pageId)) return { kind: "page", pageId: rule.target.pageId };
  }
  const i = walk.findIndex((p) => p.id === currentPageId);
  const next = i >= 0 ? walk[i + 1] : undefined;
  return next ? { kind: "page", pageId: next.id } : { kind: "ending" };
}

export function simulatePath(schema: FormSchema, answers: Answers): string[] {
  const walk = livePages(schema);
  const first = walk[0];
  if (!first) return [];
  const path: string[] = [];
  const seen = new Set<string>();
  let pageId: string | undefined = first.id;
  while (pageId) {
    if (path.length >= MAX_FLOW_STEPS) break;
    if (seen.has(pageId)) break;
    seen.add(pageId);
    path.push(pageId);
    const next = resolveNext(schema, pageId, answers);
    pageId = next.kind === "page" ? next.pageId : undefined;
  }
  return path;
}

export function questionsOnPath(schema: FormSchema, answers: Answers): Set<string> {
  const n = normalizeFormSchema(schema);
  const byId = new Map(n.pages.map((p) => [p.id, p]));
  const ids = new Set<string>();
  for (const pageId of simulatePath(n, answers)) {
    const page = byId.get(pageId);
    if (!page) continue;
    for (const id of page.questionIds) ids.add(id);
  }
  return ids;
}

export function reachablePageIds(schema: FormSchema): Set<string> {
  const n = normalizeFormSchema(schema);
  const walk = livePages(n);
  const first = walk[0];
  const liveIds = new Set(walk.map((p) => p.id));
  const reach = new Set<string>();
  if (!first) return reach;
  const queue = [first.id];
  while (queue.length) {
    const id = queue.pop()!;
    if (reach.has(id)) continue;
    reach.add(id);
    const page = walk.find((p) => p.id === id) ?? n.pages.find((p) => p.id === id);
    if (!page) continue;
    const always = (page.routing?.rules ?? []).some((r) => r.conditions.length === 0);
    const i = walk.findIndex((p) => p.id === id);
    const defaultNext = i >= 0 ? walk[i + 1] : undefined;
    if (!always && defaultNext) queue.push(defaultNext.id);
    for (const rule of page.routing?.rules ?? []) {
      if (rule.target.kind === "page" && liveIds.has(rule.target.pageId)) queue.push(rule.target.pageId);
    }
  }
  return reach;
}

export function unreachablePages(schema: FormSchema): FormPage[] {
  const reach = reachablePageIds(schema);
  return livePages(schema).filter((p) => !reach.has(p.id));
}

function questionById(schema: FormSchema, id: string): Question | undefined {
  return schema.questions.find((q) => q.id === id);
}

export function routingError(schema: FormSchema): string | null {
  const n = normalizeFormSchema(schema);
  const walk = livePages(n);
  const indexByPage = new Map(walk.map((p, i) => [p.id, i]));
  const liveIds = new Set(walk.map((p) => p.id));
  for (const p of walk) {
    const i = indexByPage.get(p.id) ?? 0;
    const allowed = new Set<string>();
    for (let j = 0; j <= i; j++) {
      for (const id of walk[j]!.questionIds) allowed.add(id);
    }
    for (const rule of p.routing?.rules ?? []) {
      for (const c of rule.conditions) {
        const q = questionById(n, c.questionId);
        if (!q || q.retired) return "Logic refers to an unknown question";
        if (!allowed.has(c.questionId)) return "Logic can only use answers from this page or earlier";
        if ((c.op === "eq" || c.op === "neq" || c.op === "contains" || c.op === "not_contains") && !c.value) {
          return "A logic condition needs a value";
        }
      }
      const target = rule.target;
      if (target.kind === "page") {
        if (!liveIds.has(target.pageId) && !n.pages.some((x) => x.id === target.pageId)) {
          return "Logic points to a missing page";
        }
      }
    }
  }
  return null;
}

const OP_LABEL: Record<LogicCondition["op"], string> = {
  eq: "=",
  neq: "≠",
  empty: "is empty",
  not_empty: "is not empty",
  contains: "contains",
  not_contains: "does not contain",
};

export function describeCondition(schema: FormSchema, condition: LogicCondition): string {
  const q = questionById(schema, condition.questionId);
  const name = q?.title.trim() || "Question";
  if (condition.op === "empty" || condition.op === "not_empty") return `${name} ${OP_LABEL[condition.op]}`;
  return `${name} ${OP_LABEL[condition.op]} ${condition.value ?? ""}`.trim();
}

export function describeRule(schema: FormSchema, rule: PageRule): string {
  if (!rule.conditions.length) return "Always";
  return rule.conditions.map((c) => describeCondition(schema, c)).join(" and ");
}

export function describeTarget(schema: FormSchema, target: FlowTarget): string {
  if (target.kind === "ending") return "Ending";
  const pages = normalizeFormSchema(schema).pages;
  const i = pages.findIndex((p) => p.id === target.pageId);
  const page = i >= 0 ? pages[i] : undefined;
  return page ? pageLabel(page, i) : "Page";
}

export function questionsForLogic(schema: FormSchema, pageId: string): Question[] {
  const n = normalizeFormSchema(schema);
  const i = n.pages.findIndex((p) => p.id === pageId);
  const slice = i >= 0 ? n.pages.slice(0, i + 1) : [];
  const allowed = new Set(slice.flatMap((p) => p.questionIds));
  return n.questions.filter((q) => q.type !== "statement" && !q.retired && allowed.has(q.id));
}

export function defaultEdges(schema: FormSchema): { from: string; to: FlowTarget }[] {
  const walk = livePages(schema);
  const edges: { from: string; to: FlowTarget }[] = [];
  if (walk[0]) edges.push({ from: FLOW_WELCOME, to: { kind: "page", pageId: walk[0].id } });
  else edges.push({ from: FLOW_WELCOME, to: { kind: "ending" } });
  for (let i = 0; i < walk.length; i++) {
    const page = walk[i]!;
    const next = walk[i + 1];
    edges.push({
      from: page.id,
      to: next ? { kind: "page", pageId: next.id } : { kind: "ending" },
    });
  }
  return edges;
}

import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { describeRule, describeTarget, questionsForLogic } from "~/shared/flow";
import {
  normalizeFormSchema,
  pageLabel,
  type FormPage,
  type FormSchema,
  type LogicCondition,
  type LogicOp,
  type PageRule,
  type PageRuleTarget,
} from "~/shared/schema";

const OPS: { op: LogicOp; label: string; needsValue: boolean }[] = [
  { op: "eq", label: "equals", needsValue: true },
  { op: "neq", label: "does not equal", needsValue: true },
  { op: "contains", label: "contains", needsValue: true },
  { op: "not_contains", label: "does not contain", needsValue: true },
  { op: "empty", label: "is empty", needsValue: false },
  { op: "not_empty", label: "is not empty", needsValue: false },
];

function needsValue(op: LogicOp): boolean {
  return OPS.find((o) => o.op === op)?.needsValue ?? false;
}

export function PageLogic(props: {
  schema: FormSchema;
  page: FormPage;
  onChange: (fn: (p: FormPage) => FormPage) => void;
}) {
  const { schema, page } = props;
  const n = normalizeFormSchema(schema);
  const questions = questionsForLogic(n, page.id);
  const pages = n.pages.filter((p) => p.id !== page.id);
  const rules = page.routing?.rules ?? [];

  function setRules(next: PageRule[]) {
    props.onChange((p) => ({ ...p, routing: next.length ? { rules: next } : undefined }));
  }

  function patchRule(id: string, fn: (r: PageRule) => PageRule) {
    setRules(rules.map((r) => (r.id === id ? fn(r) : r)));
  }

  function addRule() {
    const first = questions[0];
    const nextPage = pages[0];
    const rule: PageRule = {
      id: crypto.randomUUID(),
      conditions: first ? [{ questionId: first.id, op: "eq", value: optionsOf(first)[0] }] : [],
      target: nextPage ? { kind: "page", pageId: nextPage.id } : { kind: "ending" },
    };
    setRules([...rules, rule]);
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">After this page</p>
        <Button type="button" variant="outline" size="sm" onClick={addRule}>
          Add rule
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">First matching rule wins. Otherwise continue in order.</p>
      {rules.map((rule) => (
        <div key={rule.id} className="grid gap-2 rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">
            {describeRule(n, rule)} → {describeTarget(n, rule.target)}
          </p>
          {rule.conditions.map((c, i) => (
            <ConditionRow
              key={i}
              schema={n}
              questions={questions}
              condition={c}
              onChange={(next) =>
                patchRule(rule.id, (r) => {
                  const conditions = [...r.conditions];
                  conditions[i] = next;
                  return { ...r, conditions };
                })
              }
              onRemove={() =>
                patchRule(rule.id, (r) => ({ ...r, conditions: r.conditions.filter((_, j) => j !== i) }))
              }
            />
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!questions.length}
              onClick={() => {
                const first = questions[0];
                if (!first) return;
                patchRule(rule.id, (r) => ({
                  ...r,
                  conditions: [...r.conditions, { questionId: first.id, op: "eq", value: optionsOf(first)[0] }],
                }));
              }}
            >
              Add condition
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setRules(rules.filter((r) => r.id !== rule.id))}>
              Remove rule
            </Button>
          </div>
          <Field label="Then go to">
            <Select
              value={rule.target.kind === "ending" ? "ending" : rule.target.pageId}
              onValueChange={(v) => {
                const target: PageRuleTarget = v === "ending" ? { kind: "ending" } : { kind: "page", pageId: v };
                patchRule(rule.id, (r) => ({ ...r, target }));
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pages.map((p, i) => (
                  <SelectItem key={p.id} value={p.id}>
                    {pageLabel(p, n.pages.indexOf(p) >= 0 ? n.pages.indexOf(p) : i)}
                  </SelectItem>
                ))}
                <SelectItem value="ending">Ending</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      ))}
    </div>
  );
}

function optionsOf(q: { type: string; options?: string[] }): string[] {
  return q.type === "select" || q.type === "multi_select" ? (q.options ?? []) : [];
}

function ConditionRow(props: {
  schema: FormSchema;
  questions: ReturnType<typeof questionsForLogic>;
  condition: LogicCondition;
  onChange: (c: LogicCondition) => void;
  onRemove: () => void;
}) {
  const q = props.questions.find((x) => x.id === props.condition.questionId) ?? props.questions[0];
  const opts = q ? optionsOf(q) : [];
  return (
    <div className="grid gap-2">
      <Select
        value={props.condition.questionId}
        onValueChange={(questionId) => {
          const next = props.questions.find((x) => x.id === questionId);
          props.onChange({
            ...props.condition,
            questionId,
            value: next ? optionsOf(next)[0] ?? props.condition.value : props.condition.value,
          });
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Question" />
        </SelectTrigger>
        <SelectContent>
          {props.questions.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.title.trim() || "Untitled"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={props.condition.op}
        onValueChange={(op) => {
          const next = op as LogicOp;
          props.onChange({
            ...props.condition,
            op: next,
            value: needsValue(next) ? props.condition.value : undefined,
          });
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPS.map((o) => (
            <SelectItem key={o.op} value={o.op}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {needsValue(props.condition.op) &&
        (opts.length ? (
          <Select
            value={props.condition.value ?? opts[0]}
            onValueChange={(value) => props.onChange({ ...props.condition, value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opts.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={props.condition.value ?? ""}
            placeholder="Value"
            onChange={(e) => props.onChange({ ...props.condition, value: e.target.value })}
          />
        ))}
      <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={props.onRemove}>
        Remove condition
      </Button>
    </div>
  );
}

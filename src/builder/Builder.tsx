import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { LockIcon } from "lucide-react";
import { Field } from "@/components/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormPlayer, type PlayerScreen } from "~/player/FormPlayer";
import { FILE_KINDS, newQuestion, publishSchemaError, unpublishedChanges, type FileKind, type FormSchema, type Question } from "~/shared/schema";
import { slugify } from "~/shared/slug";
import { api, ApiError } from "~/lib/api";

const TYPES: Question["type"][] = [
  "short_text",
  "long_text",
  "email",
  "number",
  "select",
  "multi_select",
  "date",
  "file",
  "statement",
];

type Props = {
  formId: string;
  title: string;
  slug: string;
  published: boolean;
  schema: FormSchema;
  publishedSchema: FormSchema | null;
  onMeta: (p: { title: string; published: boolean; publishedSchema?: FormSchema | null }) => void;
};

export function Builder(props: Props) {
  const [title, setTitle] = useState(props.title);
  const [schema, setSchema] = useState<FormSchema>(props.schema);
  const [published, setPublished] = useState(props.published);
  const [selected, setSelected] = useState<PlayerScreen>("welcome");
  const [err, setErr] = useState<string | null>(null);
  const saved = useRef(JSON.stringify({ title: props.title, schema: props.schema }));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const publishedIds = useMemo(
    () => new Set((props.publishedSchema?.questions ?? []).map((q) => q.id)),
    [props.publishedSchema],
  );
  const diff = useMemo(() => unpublishedChanges(schema, props.publishedSchema), [schema, props.publishedSchema]);
  const canPublish = !published || diff.lines.length > 0;

  useEffect(() => {
    const now = JSON.stringify({ title, schema });
    if (now === saved.current) return;
    saved.current = now;
    const t = setTimeout(() => {
      void save();
    }, 600);
    return () => clearTimeout(t);
  }, [title, schema]);

  async function save() {
    setErr(null);
    try {
      await persist();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Save failed");
    }
  }

  function taken(exceptId?: string): Set<string> {
    return new Set(
      schema.questions
        .filter((q) => q.type !== "statement" && q.id !== exceptId)
        .map((q) => q.slug),
    );
  }

  function patchQuestion(id: string, fn: (q: Question) => Question) {
    setSchema((s) => ({ ...s, questions: s.questions.map((q) => (q.id === id ? fn(q) : q)) }));
  }

  function addQuestion(type: Question["type"]) {
    const q = newQuestion(type, taken());
    setSchema((s) => ({ ...s, questions: [...s.questions, q] }));
    setSelected({ questionId: q.id });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setSchema((s) => {
      const old = s.questions.findIndex((q) => q.id === active.id);
      const next = s.questions.findIndex((q) => q.id === over.id);
      if (old < 0 || next < 0) return s;
      return { ...s, questions: arrayMove(s.questions, old, next) };
    });
  }

  async function persist() {
    await api("/api/forms/" + props.formId, {
      method: "PUT",
      body: JSON.stringify({ title, schema }),
    });
    saved.current = JSON.stringify({ title, schema });
    props.onMeta({ title, published });
  }

  async function publishLive() {
    setErr(null);
    const pubErr = publishSchemaError(schema);
    if (pubErr) {
      setErr(pubErr);
      return;
    }
    try {
      await persist();
      await api("/api/forms/" + props.formId + "/publish", {
        method: "POST",
        body: JSON.stringify({ published: true }),
      });
      setPublished(true);
      props.onMeta({ title, published: true, publishedSchema: schema });
      toast.success("Published");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Publish failed");
    }
  }

  async function unpublish() {
    setErr(null);
    try {
      await api("/api/forms/" + props.formId + "/publish", {
        method: "POST",
        body: JSON.stringify({ published: false }),
      });
      setPublished(false);
      props.onMeta({ title, published: false });
      toast.success("Unpublished");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Unpublish failed");
    }
  }

  const inspect =
    selected === "welcome"
      ? "welcome"
      : selected === "ending"
        ? "ending"
        : schema.questions.find((q) => q.id === selected.questionId);

  return (
    <div className="flex min-h-0 min-w-[56rem] flex-1 flex-col">
      <div className="flex items-center justify-end gap-3 border-b px-4 py-3">
        {err && (
          <Alert variant="destructive" className="mr-auto">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        )}
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {canPublish && (
            <Button type="button" onClick={() => void publishLive()}>
              {published ? "Publish changes" : "Publish"}
            </Button>
          )}
          {published && (
            <Button type="button" variant="outline" onClick={() => void unpublish()}>
              Unpublish
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const url = window.location.origin + "/f/" + props.slug;
              void navigator.clipboard.writeText(url).then(
                () => toast.success("Link copied"),
                () => toast.message(url),
              );
            }}
          >
            Copy link
          </Button>
        </div>
      </div>
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[16rem_minmax(0,1fr)_18rem] overflow-x-auto">
      <aside className="flex min-h-0 flex-col border-r bg-card">
        <ScrollArea className="flex-1">
          <div className="grid gap-1 p-3">
            <Button
              type="button"
              variant={selected === "welcome" ? "secondary" : "ghost"}
              className="justify-start"
              onClick={() => setSelected("welcome")}
            >
              Welcome
              {diff.welcome ? (
                <Badge variant="secondary" className="ml-auto">
                  Edited
                </Badge>
              ) : null}
            </Button>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={schema.questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                {schema.questions.map((q) => (
                  <SortRow
                    key={q.id}
                    q={q}
                    mark={
                      publishedIds.has(q.id)
                        ? diff.questionIds.has(q.id)
                          ? "Edited"
                          : undefined
                        : props.publishedSchema
                          ? "New"
                          : undefined
                    }
                    on={typeof selected === "object" && selected.questionId === q.id}
                    onClick={() => setSelected({ questionId: q.id })}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <Button
              type="button"
              variant={selected === "ending" ? "secondary" : "ghost"}
              className="justify-start"
              onClick={() => setSelected("ending")}
            >
              Ending
              {diff.ending ? (
                <Badge variant="secondary" className="ml-auto">
                  Edited
                </Badge>
              ) : null}
            </Button>
          </div>
        </ScrollArea>
        <div className="border-t p-3">
          <Select onValueChange={(t) => addQuestion(t as Question["type"])}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Add question" />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </aside>
      <div className="min-h-[50vh] bg-muted/30">
        <FormPlayer mode="preview" schema={schema} screen={selected} />
      </div>
      <aside className="min-h-0 border-l bg-card">
        <ScrollArea className="h-full">
          <div className="grid gap-4 p-4">
            <Field label="Form title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            {inspect === "welcome" && (
              <>
                <Field label="Headline">
                  <Input
                    value={schema.welcome.title}
                    onChange={(e) => setSchema((s) => ({ ...s, welcome: { ...s.welcome, title: e.target.value } }))}
                  />
                </Field>
                <Field label="Description">
                  <Textarea
                    rows={3}
                    value={schema.welcome.description ?? ""}
                    onChange={(e) =>
                      setSchema((s) => ({ ...s, welcome: { ...s.welcome, description: e.target.value || undefined } }))
                    }
                  />
                </Field>
                <Field label="Button">
                  <Input
                    value={schema.welcome.button}
                    onChange={(e) => setSchema((s) => ({ ...s, welcome: { ...s.welcome, button: e.target.value } }))}
                  />
                </Field>
              </>
            )}
            {inspect === "ending" && (
              <>
                <Field label="Headline">
                  <Input
                    value={schema.ending.title}
                    onChange={(e) => setSchema((s) => ({ ...s, ending: { ...s.ending, title: e.target.value } }))}
                  />
                </Field>
                <Field label="Description">
                  <Textarea
                    rows={3}
                    value={schema.ending.description ?? ""}
                    onChange={(e) =>
                      setSchema((s) => ({ ...s, ending: { ...s.ending, description: e.target.value || undefined } }))
                    }
                  />
                </Field>
              </>
            )}
            {inspect && inspect !== "welcome" && inspect !== "ending" && (
              <QuestionInspect
                q={inspect}
                lockedType={publishedIds.has(inspect.id)}
                taken={taken(inspect.id)}
                onChange={(fn) => patchQuestion(inspect.id, fn)}
                onRetire={() => patchQuestion(inspect.id, (q) => ({ ...q, retired: !q.retired }))}
                onDelete={
                  publishedIds.has(inspect.id)
                    ? undefined
                    : () => {
                        setSchema((s) => ({ ...s, questions: s.questions.filter((x) => x.id !== inspect.id) }));
                        setSelected("welcome");
                      }
                }
              />
            )}
          </div>
        </ScrollArea>
      </aside>
      </div>
    </div>
  );
}

function SortRow(props: { q: Question; on: boolean; mark?: "New" | "Edited"; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: props.q.id });
  return (
    <Button
      ref={setNodeRef}
      type="button"
      variant={props.on ? "secondary" : "ghost"}
      className="h-auto w-full justify-start py-2 text-left"
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={props.onClick}
      {...attributes}
      {...listeners}
    >
      <span className="min-w-0 flex-1 truncate">
        {props.q.retired ? <Badge variant="outline" className="mr-2">Retired</Badge> : null}
        {props.q.title.trim() || "Untitled"}
      </span>
      {props.mark ? (
        <Badge variant="secondary" className="ml-2 shrink-0">
          {props.mark}
        </Badge>
      ) : null}
    </Button>
  );
}

function QuestionInspect(props: {
  q: Question;
  lockedType: boolean;
  taken: Set<string>;
  onChange: (fn: (q: Question) => Question) => void;
  onRetire: () => void;
  onDelete?: () => void;
}) {
  const { q } = props;
  function set<K extends keyof Question>(key: K, value: Question[K]) {
    props.onChange((prev) => ({ ...prev, [key]: value }) as Question);
  }
  return (
    <>
      <Field label="Title">
        <Input
          value={q.title}
          placeholder="Question title"
          onChange={(e) => {
            const title = e.target.value;
            props.onChange((prev) => {
              if (prev.type === "statement" || props.lockedType) return { ...prev, title };
              return { ...prev, title, slug: slugify(title, props.taken) };
            });
          }}
        />
      </Field>
      <Field label="Description">
        <Textarea rows={3} value={q.description ?? ""} onChange={(e) => set("description", e.target.value || undefined)} />
      </Field>
      {"slug" in q && (
        <Field
          label={props.lockedType ? "Slug · locked" : "Slug · read only"}
          hint={
            props.lockedType
              ? "Locked after publish"
              : "Generated from the title as you type"
          }
        >
          <div className="relative">
            <Input
              value={q.slug}
              readOnly
              aria-readonly="true"
              className="cursor-default bg-muted/50 pr-8 text-muted-foreground"
            />
            {props.lockedType ? (
              <LockIcon className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            ) : null}
          </div>
        </Field>
      )}
      <Field label="Type">
        <Select
          value={q.type}
          disabled={props.lockedType}
          onValueChange={(type) => {
            const fresh = newQuestion(type as Question["type"], new Set());
            props.onChange((prev) => {
              const next = { ...fresh, id: prev.id, title: prev.title };
              if (next.type !== "statement") next.slug = slugify(prev.title, props.taken);
              return next;
            });
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {"required" in q && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={q.required} onCheckedChange={(c) => set("required", Boolean(c) as never)} />
          Required
        </label>
      )}
      {"placeholder" in q && (
        <Field label="Placeholder">
          <Input value={q.placeholder ?? ""} onChange={(e) => set("placeholder", (e.target.value || undefined) as never)} />
        </Field>
      )}
      {q.type === "number" && (
        <>
          <Field label="Min">
            <Input
              type="number"
              value={q.min ?? ""}
              onChange={(e) =>
                props.onChange((prev) =>
                  prev.type === "number" ? { ...prev, min: e.target.value === "" ? undefined : Number(e.target.value) } : prev,
                )
              }
            />
          </Field>
          <Field label="Max">
            <Input
              type="number"
              value={q.max ?? ""}
              onChange={(e) =>
                props.onChange((prev) =>
                  prev.type === "number" ? { ...prev, max: e.target.value === "" ? undefined : Number(e.target.value) } : prev,
                )
              }
            />
          </Field>
        </>
      )}
      {(q.type === "select" || q.type === "multi_select") && (
        <Field label="Options (one per line)">
          <Textarea
            rows={6}
            value={q.options.join("\n")}
            onChange={(e) => {
              const options = e.target.value.split("\n");
              props.onChange((prev) =>
                prev.type === "select" || prev.type === "multi_select" ? { ...prev, options } : prev,
              );
            }}
          />
        </Field>
      )}
      {q.type === "file" && (
        <>
          <Field label="Max size (MB)">
            <Input
              type="number"
              min={1}
              max={25}
              value={q.maxSizeMb}
              onChange={(e) =>
                props.onChange((prev) =>
                  prev.type === "file"
                    ? { ...prev, maxSizeMb: Math.min(25, Math.max(1, Number(e.target.value) || 1)) }
                    : prev,
                )
              }
            />
          </Field>
          <fieldset className="grid gap-2">
            <Label>Accepted types</Label>
            {(Object.keys(FILE_KINDS) as FileKind[]).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={q.accept.includes(k)}
                  onCheckedChange={(checked) => {
                    props.onChange((prev) => {
                      if (prev.type !== "file") return prev;
                      const accept = checked ? [...prev.accept, k] : prev.accept.filter((x) => x !== k);
                      return { ...prev, accept: accept.length ? accept : prev.accept };
                    });
                  }}
                />
                {FILE_KINDS[k].label}
              </label>
            ))}
          </fieldset>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={props.onRetire}>
          {q.retired ? "Unretire" : "Retire"}
        </Button>
        {props.onDelete && (
          <Button type="button" variant="destructive" onClick={props.onDelete}>
            Delete
          </Button>
        )}
      </div>
    </>
  );
}

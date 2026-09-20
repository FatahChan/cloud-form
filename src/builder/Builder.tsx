import { DndContext, PointerSensor, closestCenter, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
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
import { FlowMap } from "~/builder/FlowMap";
import { PageLogic } from "~/builder/PageLogic";
import { unreachablePages, routingError } from "~/shared/flow";
import {
  FILE_KINDS,
  newPage,
  newQuestion,
  normalizeFormSchema,
  pageLabel,
  publishSchemaError,
  questionsOnPage,
  removePage,
  unpublishedChanges,
  type FileKind,
  type FormPage,
  type FormSchema,
  type Question,
} from "~/shared/schema";
import { slugify } from "~/shared/slug";
import { api, ApiError } from "~/lib/api";

const TYPES: Question["type"][] = [
  "short_text",
  "long_text",
  "email",
  "phone",
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

function isQuestionScreen(s: PlayerScreen): s is { questionId: string } {
  return typeof s === "object" && "questionId" in s;
}

function isPageScreen(s: PlayerScreen): s is { pageId: string } {
  return typeof s === "object" && "pageId" in s;
}

function targetPageId(schema: FormSchema, selected: PlayerScreen): string | undefined {
  const pages = normalizeFormSchema(schema).pages;
  if (isPageScreen(selected)) return selected.pageId;
  if (isQuestionScreen(selected)) return pages.find((p) => p.questionIds.includes(selected.questionId))?.id;
  return pages[pages.length - 1]?.id;
}

function pageTitle(page: FormPage, index: number): string {
  return pageLabel(page, index);
}

function moveQuestion(schema: FormSchema, questionId: string, destPageId: string, destIndex?: number): FormSchema {
  const n = normalizeFormSchema(schema);
  const stripped = n.pages.map((p) => ({ ...p, questionIds: p.questionIds.filter((id) => id !== questionId) }));
  const dest = stripped.find((p) => p.id === destPageId);
  if (!dest) return n;
  const at = destIndex === undefined ? dest.questionIds.length : Math.max(0, Math.min(destIndex, dest.questionIds.length));
  dest.questionIds.splice(at, 0, questionId);
  return normalizeFormSchema({ ...n, pages: stripped });
}

export function Builder(props: Props) {
  const [title, setTitle] = useState(props.title);
  const [schema, setSchema] = useState<FormSchema>(() => normalizeFormSchema(props.schema));
  const [published, setPublished] = useState(props.published);
  const [selected, setSelected] = useState<PlayerScreen>("welcome");
  const [view, setView] = useState<"build" | "flow">("build");
  const [err, setErr] = useState<string | null>(null);
  const publishedTitle = useRef(props.title);
  const saved = useRef<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const publishedIds = useMemo(
    () => new Set((props.publishedSchema?.questions ?? []).map((q) => q.id)),
    [props.publishedSchema],
  );
  const diff = useMemo(() => unpublishedChanges(schema, props.publishedSchema), [schema, props.publishedSchema]);
  const canPublish = !published || diff.lines.length > 0 || title.trim() !== publishedTitle.current.trim();
  const pages = schema.pages ?? [];
  const deadPages = useMemo(() => unreachablePages(schema), [schema]);

  useEffect(() => {
    const now = JSON.stringify({ title, schema });
    if (saved.current === null) {
      saved.current = now;
      return;
    }
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
      schema.questions.filter((q) => q.type !== "statement" && q.id !== exceptId).map((q) => q.slug),
    );
  }

  function patchQuestion(id: string, fn: (q: Question) => Question) {
    setSchema((s) => ({ ...s, questions: s.questions.map((q) => (q.id === id ? fn(q) : q)) }));
  }

  function patchPage(id: string, fn: (p: FormPage) => FormPage) {
    setSchema((s) => {
      const n = normalizeFormSchema(s);
      return { ...n, pages: n.pages.map((p) => (p.id === id ? fn(p) : p)) };
    });
  }

  function addQuestion(type: Question["type"]) {
    const q = newQuestion(type, taken());
    setSchema((s) => {
      const n = normalizeFormSchema(s);
      const pid = targetPageId(n, selected);
      const nextPages = n.pages.length
        ? n.pages.map((p) => (p.id === pid ? { ...p, questionIds: [...p.questionIds, q.id] } : p))
        : [newPage([q.id])];
      if (pid && !nextPages.some((p) => p.id === pid)) nextPages.push(newPage([q.id]));
      return normalizeFormSchema({ ...n, questions: [...n.questions, q], pages: nextPages });
    });
    setSelected({ questionId: q.id });
  }

  function addPage() {
    const page = newPage([]);
    setSchema((s) => {
      const n = normalizeFormSchema(s);
      const pid = targetPageId(n, selected);
      const idx = n.pages.findIndex((p) => p.id === pid);
      const pages = [...n.pages];
      pages.splice(idx >= 0 ? idx + 1 : pages.length, 0, page);
      return { ...n, pages };
    });
    setSelected({ pageId: page.id });
  }

  function deletePage(pageId: string) {
    const n = normalizeFormSchema(schema);
    const idx = n.pages.findIndex((p) => p.id === pageId);
    const dest = (idx > 0 ? n.pages[idx - 1] : n.pages[idx + 1]) ?? undefined;
    setSchema((s) => removePage(s, pageId));
    setSelected(dest ? { pageId: dest.id } : "welcome");
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    setSchema((s) => {
      const n = normalizeFormSchema(s);
      const from = n.pages.find((p) => p.questionIds.includes(activeId));
      const toPageId = overId.startsWith("page:")
        ? overId.slice(5)
        : n.pages.find((p) => p.questionIds.includes(overId))?.id;
      const to = n.pages.find((p) => p.id === toPageId);
      if (!from || !to) return n;
      if (from.id === to.id && !overId.startsWith("page:")) {
        const ids = arrayMove(from.questionIds, from.questionIds.indexOf(activeId), from.questionIds.indexOf(overId));
        return normalizeFormSchema({ ...n, pages: n.pages.map((p) => (p.id === from.id ? { ...p, questionIds: ids } : p)) });
      }
      const destIndex = overId.startsWith("page:") ? to.questionIds.filter((id) => id !== activeId).length : undefined;
      const insertAt = destIndex ?? to.questionIds.filter((id) => id !== activeId).indexOf(overId);
      return moveQuestion(n, activeId, to.id, insertAt < 0 ? to.questionIds.length : insertAt);
    });
  }

  async function persist() {
    await api("/api/forms/" + props.formId, {
      method: "PUT",
      body: JSON.stringify({ title, schema: normalizeFormSchema(schema) }),
    });
    saved.current = JSON.stringify({ title, schema });
    props.onMeta({ title, published });
  }

  async function publishLive() {
    setErr(null);
    const pubErr = publishSchemaError(schema) ?? routingError(schema);
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
      publishedTitle.current = title;
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

  const inspectPage = isPageScreen(selected) ? pages.find((p) => p.id === selected.pageId) : undefined;
  const inspectQuestion = isQuestionScreen(selected)
    ? schema.questions.find((q) => q.id === selected.questionId)
    : undefined;

  return (
    <div className="flex min-h-0 min-w-[56rem] flex-1 flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Input
          aria-label="Form title"
          className="max-w-xs"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        {err && (
          <Alert variant="destructive" className="min-w-0 flex-1">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        )}
        {deadPages.length > 0 && !err && (
          <Alert className="min-w-0 flex-1">
            <AlertDescription>
              Unreachable: {deadPages.map((p, i) => pageTitle(p, pages.indexOf(p) >= 0 ? pages.indexOf(p) : i)).join(", ")}
            </AlertDescription>
          </Alert>
        )}
        <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-2">
          <div className="flex rounded-lg border p-0.5">
            <Button
              type="button"
              size="sm"
              variant={view === "build" ? "secondary" : "ghost"}
              onClick={() => setView("build")}
            >
              Build
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === "flow" ? "secondary" : "ghost"}
              onClick={() => setView("flow")}
            >
              Flow
            </Button>
          </div>
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
              {pages.map((page, i) => (
                <PageDrop key={page.id} id={"page:" + page.id}>
                  <Button
                    type="button"
                    variant={isPageScreen(selected) && selected.pageId === page.id ? "secondary" : "ghost"}
                    className="mt-1 w-full justify-start font-medium"
                    onClick={() => setSelected({ pageId: page.id })}
                  >
                    {pageTitle(page, i)}
                    {diff.pages && (page.title || page.description) ? (
                      <Badge variant="secondary" className="ml-auto">
                        Edited
                      </Badge>
                    ) : null}
                  </Button>
                  <SortableContext items={page.questionIds} strategy={verticalListSortingStrategy}>
                    {questionsOnPage(schema, page).map((q) => (
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
                        on={isQuestionScreen(selected) && selected.questionId === q.id}
                        onClick={() => setSelected({ questionId: q.id })}
                      />
                    ))}
                  </SortableContext>
                </PageDrop>
              ))}
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
        <div className="grid gap-2 border-t p-3">
          <Button type="button" variant="outline" onClick={addPage}>
            Add page
          </Button>
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
      <div className="h-full min-h-[50vh] bg-muted/30">
        {view === "flow" ? (
          <FlowMap schema={schema} selected={selected} onSelect={setSelected} onChange={setSchema} />
        ) : (
          <FormPlayer mode="preview" schema={schema} screen={selected} />
        )}
      </div>
      <aside className="min-h-0 border-l bg-card">
        <ScrollArea className="h-full">
          <div className="grid gap-4 p-4">
            {selected === "welcome" && (
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
            {selected === "ending" && (
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
            {inspectPage && (
              <>
                <Field label="Page title">
                  <Input
                    value={inspectPage.title ?? ""}
                    placeholder={pageTitle(inspectPage, pages.indexOf(inspectPage))}
                    onChange={(e) =>
                      patchPage(inspectPage.id, (p) => ({ ...p, title: e.target.value || undefined }))
                    }
                  />
                </Field>
                <Field label="Page description">
                  <Textarea
                    rows={3}
                    value={inspectPage.description ?? ""}
                    onChange={(e) =>
                      patchPage(inspectPage.id, (p) => ({ ...p, description: e.target.value || undefined }))
                    }
                  />
                </Field>
                <PageLogic schema={schema} page={inspectPage} onChange={(fn) => patchPage(inspectPage.id, fn)} />
                {pages.length > 1 && (
                  <Button type="button" variant="destructive" onClick={() => deletePage(inspectPage.id)}>
                    Delete page
                  </Button>
                )}
              </>
            )}
            {inspectQuestion && (
              <QuestionInspect
                q={inspectQuestion}
                lockedType={publishedIds.has(inspectQuestion.id)}
                taken={taken(inspectQuestion.id)}
                pages={pages}
                currentPageId={targetPageId(schema, selected)}
                onMovePage={(pageId) => {
                  setSchema((s) => moveQuestion(s, inspectQuestion.id, pageId));
                }}
                onChange={(fn) => patchQuestion(inspectQuestion.id, fn)}
                onRetire={() => patchQuestion(inspectQuestion.id, (q) => ({ ...q, retired: !q.retired }))}
                onDelete={
                  publishedIds.has(inspectQuestion.id)
                    ? undefined
                    : () => {
                        setSchema((s) => {
                          const n = normalizeFormSchema(s);
                          return normalizeFormSchema({
                            ...n,
                            questions: n.questions.filter((x) => x.id !== inspectQuestion.id),
                            pages: n.pages.map((p) => ({
                              ...p,
                              questionIds: p.questionIds.filter((id) => id !== inspectQuestion.id),
                            })),
                          });
                        });
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

function PageDrop(props: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: props.id });
  return (
    <div ref={setNodeRef} className="grid gap-1">
      {props.children}
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
      className="h-auto w-full justify-start py-2 pl-6 text-left"
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
  pages: FormPage[];
  currentPageId?: string;
  onMovePage: (pageId: string) => void;
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
      {props.pages.length > 1 && props.currentPageId && (
        <Field label="Page">
          <Select value={props.currentPageId} onValueChange={props.onMovePage}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {props.pages.map((p, i) => (
                <SelectItem key={p.id} value={p.id}>
                  {pageTitle(p, i)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
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

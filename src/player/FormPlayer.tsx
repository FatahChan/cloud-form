import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "~/lib/api";
import {
  acceptAttr,
  FILE_KINDS,
  liveQuestions,
  type FileKind,
  type FormSchema,
  type Question,
} from "~/shared/schema";

export type PlayerScreen = "welcome" | "ending" | { questionId: string };

type Phase = { kind: "welcome" } | { kind: "q"; i: number } | { kind: "ending" };

type Props = {
  schema: FormSchema;
  mode: "live" | "preview";
  slug?: string;
  screen?: PlayerScreen;
};

function letter(i: number): string {
  return String.fromCharCode(65 + i);
}

export function FormPlayer({ schema, mode, slug, screen }: Props) {
  const walk = useMemo(
    () => (mode === "live" ? liveQuestions(schema) : schema.questions),
    [mode, schema],
  );
  const barQs = useMemo(() => liveQuestions(schema), [schema]);
  const [phase, setPhase] = useState<Phase>({ kind: "welcome" });
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== "preview" || screen === undefined) return;
    if (screen === "welcome") setPhase({ kind: "welcome" });
    else if (screen === "ending") setPhase({ kind: "ending" });
    else {
      const i = walk.findIndex((q) => q.id === screen.questionId);
      if (i >= 0) setPhase({ kind: "q", i });
    }
  }, [mode, screen, walk]);

  const q: Question | undefined = phase.kind === "q" ? walk[phase.i] : undefined;
  const barIndex = q ? barQs.findIndex((x) => x.id === q.id) : -1;
  const nextQ = (from: number) => {
    let n = from + 1;
    if (mode === "preview") {
      while (n < walk.length && walk[n]?.retired) n++;
    }
    return n;
  };
  const isLastQ = phase.kind === "q" && nextQ(phase.i) >= walk.length;
  const progress =
    barQs.length === 0
      ? 0
      : phase.kind === "ending"
        ? 100
        : barIndex >= 0
          ? (barIndex / barQs.length) * 100
          : 0;

  const setAns = (id: string, v: unknown) => {
    setAnswers((a) => ({ ...a, [id]: v }));
    setError(null);
  };

  const validate = (question: Question): string | null => {
    if (question.type === "statement" || !("required" in question) || !question.required) return null;
    const v = answers[question.id];
    if (v === undefined || v === null || v === "") return "This question is required";
    if (question.type === "multi_select" && Array.isArray(v) && v.length === 0) return "This question is required";
    if (question.type === "email" && typeof v === "string") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return "Enter a valid email";
    }
    if (question.type === "file" && !(v && typeof v === "object" && "uploadId" in v)) return "Add a file";
    return null;
  };

  const submitOrThanks = useCallback(async () => {
    if (mode === "preview") {
      setPhase({ kind: "ending" });
      return;
    }
    if (!slug) {
      setError("Missing form");
      return;
    }
    setBusy(true);
    try {
      await api("/api/public/forms/" + slug + "/submit", {
        method: "POST",
        body: JSON.stringify({ answers }),
      });
      setPhase({ kind: "ending" });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }, [mode, slug, answers]);

  const goNext = useCallback(async () => {
    setError(null);
    if (phase.kind === "welcome") {
      if (walk.length) setPhase({ kind: "q", i: 0 });
      else await submitOrThanks();
      return;
    }
    if (phase.kind !== "q") return;
    const cur = walk[phase.i];
    if (cur) {
      const err = validate(cur);
      if (err) {
        setError(err);
        return;
      }
    }
    const n = nextQ(phase.i);
    if (n < walk.length) setPhase({ kind: "q", i: n });
    else await submitOrThanks();
  }, [phase, walk, mode, submitOrThanks]);

  const goBack = () => {
    setError(null);
    if (phase.kind === "ending") {
      let n = walk.length - 1;
      if (mode === "preview") {
        while (n >= 0 && walk[n]?.retired) n--;
      }
      if (n >= 0) setPhase({ kind: "q", i: n });
      else setPhase({ kind: "welcome" });
      return;
    }
    if (phase.kind === "q") {
      let n = phase.i - 1;
      if (mode === "preview") {
        while (n >= 0 && walk[n]?.retired) n--;
      }
      if (n >= 0) setPhase({ kind: "q", i: n });
      else setPhase({ kind: "welcome" });
    }
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" && !e.shiftKey) {
        if (q?.type === "long_text") return;
        e.preventDefault();
        void goNext();
        return;
      }
      if (!q || (q.type !== "select" && q.type !== "multi_select")) return;
      const k = e.key.toUpperCase();
      if (k.length !== 1 || k < "A" || k > "Z") return;
      const idx = k.charCodeAt(0) - 65;
      if (idx >= q.options.length) return;
      const opt = q.options[idx];
      if (q.type === "select") setAns(q.id, opt);
      else {
        const cur = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
        setAns(q.id, cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, q, answers]);

  async function onPickFile(file: File, question: Extract<Question, { type: "file" }>) {
    if (mode === "preview") return;
    if (!slug) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("questionId", question.id);
      const res = await fetch("/api/public/forms/" + slug + "/files", { method: "POST", body: fd });
      const data = (await res.json()) as { uploadId?: string; error?: string };
      if (!res.ok) throw new ApiError(data.error ?? "Upload failed", res.status);
      if (!data.uploadId) throw new ApiError("Upload failed", 400);
      setAns(question.id, { uploadId: data.uploadId, name: file.name });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <Progress value={progress} className="h-1 rounded-none" />
      {phase.kind === "welcome" && (
        <Screen title={schema.welcome.title} description={schema.welcome.description}>
          <Button size="lg" className="w-fit" type="button" onClick={() => void goNext()}>
            {schema.welcome.button}
          </Button>
        </Screen>
      )}
      {phase.kind === "q" && q && (
        <Screen
          title={q.title}
          description={q.description}
          back={goBack}
          ok={q.type !== "statement" || isLastQ}
          onOk={() => void goNext()}
          okLabel={isLastQ ? "Submit" : "OK"}
          error={error}
          busy={busy}
        >
          <Field q={q} value={answers[q.id]} onChange={(v) => setAns(q.id, v)} mode={mode} onPickFile={onPickFile} />
        </Screen>
      )}
      {phase.kind === "ending" && (
        <Screen
          title={schema.ending.title}
          description={schema.ending.description}
          back={mode === "preview" ? goBack : undefined}
        />
      )}
    </div>
  );
}

function Screen(props: {
  title: string;
  description?: string;
  children?: ReactNode;
  back?: () => void;
  ok?: boolean;
  onOk?: () => void;
  okLabel?: string;
  error?: string | null;
  busy?: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-6 py-16">
      {props.back && (
        <Button variant="ghost" size="sm" className="w-fit px-0" type="button" aria-label="Back" onClick={props.back}>
          ← Back
        </Button>
      )}
      <h1 className="font-heading text-3xl font-medium tracking-tight text-balance">{props.title}</h1>
      {props.description && <p className="text-muted-foreground">{props.description}</p>}
      {props.children}
      {props.error && (
        <Alert variant="destructive">
          <AlertDescription>{props.error}</AlertDescription>
        </Alert>
      )}
      {props.ok && (
        <div>
          <Button size="lg" className="w-fit" type="button" disabled={props.busy} onClick={props.onOk}>
            {props.okLabel ?? "OK"} <Kbd className="ml-1">↵</Kbd>
          </Button>
        </div>
      )}
    </div>
  );
}

function Field(props: {
  q: Question;
  value: unknown;
  onChange: (v: unknown) => void;
  mode: "live" | "preview";
  onPickFile: (file: File, q: Extract<Question, { type: "file" }>) => void;
}) {
  const { q, value, onChange } = props;
  if (q.type === "statement") return null;
  if (q.type === "short_text" || q.type === "email") {
    return (
      <Input
        autoFocus
        className="h-11 text-base"
        type={q.type === "email" ? "email" : "text"}
        aria-label={q.title}
        placeholder={q.placeholder}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (q.type === "long_text") {
    return (
      <Textarea
        autoFocus
        rows={5}
        className="text-base"
        aria-label={q.title}
        placeholder={q.placeholder}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (q.type === "number") {
    return (
      <Input
        autoFocus
        className="h-11 text-base"
        type="number"
        aria-label={q.title}
        min={q.min}
        max={q.max}
        value={typeof value === "number" || typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      />
    );
  }
  if (q.type === "date") {
    return (
      <Input
        autoFocus
        className="h-11 text-base"
        type="date"
        aria-label={q.title}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (q.type === "select" || q.type === "multi_select") {
    const selected = q.type === "select" ? value : Array.isArray(value) ? value : [];
    return (
      <ul className="grid gap-2">
        {q.options.map((opt, i) => {
          const on = q.type === "select" ? selected === opt : (selected as string[]).includes(opt);
          return (
            <li key={opt}>
              <Button
                type="button"
                variant={on ? "default" : "outline"}
                className="h-auto w-full justify-start gap-3 py-3"
                onClick={() => {
                  if (q.type === "select") onChange(opt);
                  else {
                    const cur = Array.isArray(value) ? (value as string[]) : [];
                    onChange(cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]);
                  }
                }}
              >
                <Kbd>{letter(i)}</Kbd>
                {opt}
              </Button>
            </li>
          );
        })}
      </ul>
    );
  }
  const kinds = q.accept as FileKind[];
  const labels = kinds.map((k) => FILE_KINDS[k].label).join(", ");
  const uploaded = value && typeof value === "object" && "uploadId" in value ? (value as { name?: string }) : null;
  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted-foreground">
        {labels}. Max {q.maxSizeMb} MB.
      </p>
      {props.mode === "preview" ? (
        <p className="text-sm text-muted-foreground">File picker disabled in preview.</p>
      ) : (
        <Input
          type="file"
          aria-label={q.title}
          accept={acceptAttr(kinds)}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) props.onPickFile(f, q);
          }}
        />
      )}
      {uploaded?.name && <p className="text-sm text-muted-foreground">Uploaded {uploaded.name}</p>}
    </div>
  );
}

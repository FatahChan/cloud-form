import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { handleAudit, handleSetup, handleSetupNeeded } from "../src/server/auth";
import { hashPassword, verifyPassword } from "../src/server/password";
import { handleForm, handleListForms, handlePublish } from "../src/server/forms";
import { tableName } from "../src/server/formTable";
import { handleInbox, handlePublicSubmit, handlePublicUpload } from "../src/server/submissions";
import { unpublishedChanges, newQuestion, parseAnswers, type FormSchema } from "../src/shared/schema";
import { slugify } from "../src/shared/slug";

const EMAIL_ID = "33333333-3333-4333-8333-333333333333";
const FILE_ID = "22222222-2222-4222-8222-222222222222";
const EXTRA_ID = "44444444-4444-4444-8444-444444444444";
const PHONE_ID = "55555555-5555-4555-8555-555555555555";

function req(path: string, init: RequestInit = {}, cookie?: string): Request {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (cookie) headers.set("Cookie", cookie);
  return new Request("https://example.com" + path, { ...init, headers });
}

function sid(res: Response): string {
  const c = res.headers.get("Set-Cookie") ?? "";
  const m = /sid=[^;]+/.exec(c);
  if (!m) throw new Error("missing session cookie");
  return m[0];
}

const baseSchema: FormSchema = {
  welcome: { title: "Apply", button: "Start" },
  questions: [
    {
      type: "email",
      id: EMAIL_ID,
      slug: "email",
      title: "Work email",
      required: true,
    },
    {
      type: "file",
      id: FILE_ID,
      slug: "cv",
      title: "CV",
      required: true,
      maxSizeMb: 10,
      accept: ["pdf"],
    },
  ],
  ending: { title: "Thanks" },
};

describe("form flow", () => {
  it("hashes passwords at the Workers PBKDF2 cap", async () => {
    const stored = await hashPassword("password1");
    expect(stored.startsWith("pbkdf2$100000$")).toBe(true);
    expect(await verifyPassword("password1", stored)).toBe(true);
  });

  it("setup, publish CREATE, ALTER, pdf/png, submit, email column, R2", async () => {
    const needed = await handleSetupNeeded();
    expect(await needed.json()).toEqual({ needed: true });

    const setup = await handleSetup(
      req("/api/setup", {
        method: "POST",
        body: JSON.stringify({ email: "owner@x.com", name: "Owner", password: "password1" }),
      }),
    );
    expect(setup.status).toBe(200);
    const cookie = sid(setup);

    const audit = await handleAudit(req("/api/audit", {}, cookie));
    expect(((await audit.json()) as { events: { actor: string }[] }).events[0]?.actor).toBe("owner@x.com");

    const created = await handleListForms(req("/api/forms", { method: "POST", body: JSON.stringify({ title: "Job" }) }, cookie));
    expect(created.status).toBe(200);
    const form = (await created.json()) as { id: string; slug: string; title: string };
    const table = tableName(form.id);

    const afterCreate = await handleAudit(req("/api/audit", {}, cookie));
    expect(((await afterCreate.json()) as { events: { action: string; entity: string; entity_id: string }[] }).events[0]).toMatchObject({
      action: "form.create",
      entity: "Job",
      entity_id: form.id,
    });

    const put = await handleForm(
      req("/api/forms/" + form.id, { method: "PUT", body: JSON.stringify({ title: "Job", schema: baseSchema }) }, cookie),
      form.id,
    );
    expect(put.status).toBe(200);

    const pub = await handlePublish(
      req("/api/forms/" + form.id + "/publish", { method: "POST", body: JSON.stringify({ published: true }) }, cookie),
      form.id,
    );
    expect(pub.status).toBe(200);

    const createdTable = await env.DB.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
      .bind(table)
      .first<{ sql: string }>();
    expect(createdTable?.sql).toMatch(/CREATE TABLE/i);
    expect(createdTable?.sql).toMatch(/email/i);

    const migs = await env.DB.prepare("SELECT sql FROM form_migrations WHERE form_id = ? ORDER BY created_at").bind(form.id).all<{
      sql: string;
    }>();
    expect(migs.results?.[0]?.sql).toMatch(/CREATE TABLE/);

    const withExtra: FormSchema = {
      ...baseSchema,
      questions: [
        ...baseSchema.questions,
        { type: "short_text", id: EXTRA_ID, slug: "company", title: "Company", required: false },
        { type: "phone", id: PHONE_ID, slug: "phone", title: "Phone", required: false },
      ],
    };
    const put2 = await handleForm(
      req("/api/forms/" + form.id, { method: "PUT", body: JSON.stringify({ title: "Job", schema: withExtra }) }, cookie),
      form.id,
    );
    expect(put2.status).toBe(200);
    const inboxDraft = await handleInbox(req("/api/forms/" + form.id + "/submissions", {}, cookie), form.id);
    expect(
      ((await inboxDraft.json()) as { schema: FormSchema }).schema.questions.some((q) => q.type === "phone"),
    ).toBe(true);
    const pub2 = await handlePublish(
      req("/api/forms/" + form.id + "/publish", { method: "POST", body: JSON.stringify({ published: true }) }, cookie),
      form.id,
    );
    expect(pub2.status).toBe(200);
    const migs2 = await env.DB.prepare("SELECT sql FROM form_migrations WHERE form_id = ? ORDER BY created_at").bind(form.id).all<{
      sql: string;
    }>();
    expect(migs2.results?.some((r) => /ALTER TABLE/.test(r.sql))).toBe(true);

    const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "cv.pdf", { type: "application/pdf" });
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "x.png", { type: "image/png" });

    const bad = new FormData();
    bad.append("file", png);
    bad.append("questionId", FILE_ID);
    const pngRes = await handlePublicUpload(req("/api/public/forms/" + form.slug + "/files", { method: "POST", body: bad }), form.slug);
    expect(pngRes.status).toBe(415);

    const good = new FormData();
    good.append("file", pdf);
    good.append("questionId", FILE_ID);
    const pdfRes = await handlePublicUpload(req("/api/public/forms/" + form.slug + "/files", { method: "POST", body: good }), form.slug);
    expect(pdfRes.status).toBe(200);
    const { uploadId } = (await pdfRes.json()) as { uploadId: string };

    const submit = await handlePublicSubmit(
      req("/api/public/forms/" + form.slug + "/submit", {
        method: "POST",
        body: JSON.stringify({
          answers: {
            [EMAIL_ID]: "ada@x.com",
            [FILE_ID]: { uploadId },
            [PHONE_ID]: "+20 10 1234 5678",
          },
        }),
      }),
      form.slug,
    );
    expect(submit.status).toBe(200);

    const found = await env.DB.prepare(`SELECT id FROM ${table} WHERE email = ?`).bind("ada@x.com").first<{ id: string }>();
    expect(found?.id).toBeTruthy();

    const fileRow = await env.DB.prepare("SELECT r2_key FROM files WHERE submission_id = ?")
      .bind(found!.id)
      .first<{ r2_key: string }>();
    expect(fileRow?.r2_key).toMatch(/^submissions\//);
    const obj = await env.FILES.get(fileRow!.r2_key);
    expect(obj).toBeTruthy();

    const inbox = await handleInbox(req("/api/forms/" + form.id + "/submissions", {}, cookie), form.id);
    const listed = (await inbox.json()) as {
      submissions: Record<string, unknown>[];
      files: { filename: string; question_id: string }[];
    };
    expect(listed.submissions[0]?.phone).toBe("+201012345678");
    expect(listed.files.some((f) => f.filename === "cv.pdf" && f.question_id === FILE_ID)).toBe(true);
  });
});

describe("unpublishedChanges", () => {
  it("lists added and edited questions vs published schema", () => {
    const next: FormSchema = {
      ...baseSchema,
      welcome: { ...baseSchema.welcome, title: "Apply now" },
      questions: [
        { ...baseSchema.questions[0], title: "Work email address" },
        baseSchema.questions[1],
        { type: "short_text", id: EXTRA_ID, slug: "company", title: "Company", required: false },
      ],
    };
    const d = unpublishedChanges(next, baseSchema);
    expect(d.welcome).toBe(true);
    expect(d.lines).toContain("Welcome screen");
    expect(d.lines).toContain("Renamed “Work email” → “Work email address”");
    expect(d.lines).toContain("Added “Company”");
    expect(d.questionIds.has(EMAIL_ID)).toBe(true);
    expect(d.questionIds.has(EXTRA_ID)).toBe(true);
  });
});

describe("slugify", () => {
  it("builds the slug from the title, not the field type", () => {
    expect(slugify("Work email", new Set())).toBe("work_email");
    expect(slugify("How old are you?", new Set())).toBe("how_old_are_you");
    expect(slugify("!!!", new Set())).toBe("field");
    const q = newQuestion("number", new Set());
    expect(q).toMatchObject({ type: "number", slug: "field", title: "" });
  });
});

describe("parseAnswers phone", () => {
  const schema: FormSchema = {
    welcome: { title: "H", button: "Go" },
    questions: [{ type: "phone", id: EXTRA_ID, slug: "phone", title: "Phone", required: true }],
    ending: { title: "T" },
  };

  it("stores digits and rejects junk", () => {
    expect(parseAnswers(schema, { [EXTRA_ID]: "+20 10 1234 5678" })).toEqual({
      ok: true,
      data: { [EXTRA_ID]: "+201012345678" },
    });
    expect(parseAnswers(schema, { [EXTRA_ID]: "+1 213 373 4253" })).toEqual({
      ok: true,
      data: { [EXTRA_ID]: "+12133734253" },
    });
    expect(parseAnswers(schema, { [EXTRA_ID]: "(555) 123-4567" }).ok).toBe(false);
    expect(parseAnswers(schema, { [EXTRA_ID]: "nope" }).ok).toBe(false);
  });
});

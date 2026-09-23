import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/server/password";
import * as auth from "../src/server/services/auth";
import * as forms from "../src/server/services/forms";
import * as submissions from "../src/server/services/submissions";
import { tableName } from "../src/server/formTable";
import { validateSession } from "../src/server/session";
import { parseAnswers } from "../src/shared/answers";
import { unpublishedChanges, newQuestion, type FormSchema } from "../src/shared/schema";
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

function sid(cookie: string): string {
  const m = /sid=[^;]+/.exec(cookie);
  if (!m) throw new Error("missing session cookie");
  return m[0];
}

async function sessionUser(cookie: string) {
  const s = await validateSession(env.DB, req("/", {}, sid(cookie)));
  if (!s) throw new Error("no session");
  return s.user;
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
    expect(await auth.setupNeeded()).toEqual({ needed: true });

    const { cookie } = await auth.setup(
      { email: "owner@x.com", name: "Owner", password: "password1" },
      req("/api/setup", { method: "POST" }),
    );
    const user = await sessionUser(cookie);

    const audit = await auth.listAudit(50);
    expect((audit.events as { actor: string }[])[0]?.actor).toBe("owner@x.com");

    const form = await forms.createForm(user, { title: "Job" });
    const listed = await forms.listForms();
    expect(listed.forms[0]).toMatchObject({
      id: form.id,
      created_by_name: "Owner",
      updated_by_name: "Owner",
    });
    const table = tableName(form.id, "Job");
    expect(table).toMatch(/^f_job_[0-9a-f]{8}$/);

    const afterCreate = await auth.listAudit(50);
    expect((afterCreate.events as { action: string; entity: string; entity_id: string }[])[0]).toMatchObject({
      action: "form.create",
      entity: "Job",
      entity_id: form.id,
    });

    await forms.updateForm(user, form.id, { title: "Job", schema: baseSchema });
    await forms.publishForm(user, form.id, true);

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
      pages: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          title: "Apply",
          questionIds: [EMAIL_ID, FILE_ID, EXTRA_ID, PHONE_ID],
        },
      ],
    };
    await forms.updateForm(user, form.id, { title: "Job", schema: withExtra });
    const inboxDraft = await submissions.listInbox(form.id);
    expect(inboxDraft.schema.questions.some((q) => q.type === "phone")).toBe(true);
    await forms.publishForm(user, form.id, true);
    const migs2 = await env.DB.prepare("SELECT sql FROM form_migrations WHERE form_id = ? ORDER BY created_at").bind(form.id).all<{
      sql: string;
    }>();
    expect(migs2.results?.some((r: { sql: string }) => /ALTER TABLE/.test(r.sql))).toBe(true);

    const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "cv.pdf", { type: "application/pdf" });
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "x.png", { type: "image/png" });

    await expect(submissions.uploadPublicFile(form.slug, png, FILE_ID)).rejects.toMatchObject({ status: 415 });

    const { uploadId } = await submissions.uploadPublicFile(form.slug, pdf, FILE_ID);

    await submissions.submitPublic(form.slug, {
      [EMAIL_ID]: "ada@x.com",
      [FILE_ID]: { uploadId },
      [PHONE_ID]: "+20 10 1234 5678",
    });

    const found = await env.DB.prepare(`SELECT id FROM ${table} WHERE email = ?`).bind("ada@x.com").first<{ id: string }>();
    expect(found?.id).toBeTruthy();

    const fileRow = await env.DB.prepare("SELECT r2_key FROM files WHERE submission_id = ?")
      .bind(found!.id)
      .first<{ r2_key: string }>();
    expect(fileRow?.r2_key).toMatch(/^submissions\//);
    const obj = await env.FILES.get(fileRow!.r2_key);
    expect(obj).toBeTruthy();

    const inbox = await submissions.listInbox(form.id);
    expect(inbox.submissions[0]?.phone).toBe("+201012345678");
    expect(inbox.files.some((f) => f.filename === "cv.pdf" && f.question_id === FILE_ID)).toBe(true);

    const olderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
    await env.DB.prepare(`INSERT INTO ${table} (id, created_at, email) VALUES (?, ?, ?)`).bind(olderId, 1, "older@x.com").run();
    const page1 = await submissions.listInbox(form.id, { limit: 1 });
    expect(page1.submissions).toHaveLength(1);
    expect(page1.isDone).toBe(false);
    expect(page1.continueCursor).toBeTruthy();
    const page2 = await submissions.listInbox(form.id, { limit: 1, cursor: page1.continueCursor });
    expect(page2.submissions[0]?.id).toBe(olderId);
    expect(page2.isDone).toBe(true);
    const foundOlder = await submissions.listInbox(form.id, { q: "older" });
    expect(foundOlder.submissions.some((s) => s.email === "older@x.com")).toBe(true);
    const byEmail = await submissions.listInbox(form.id, { slug: "email", q: "ada" });
    expect(byEmail.submissions.some((s) => s.email === "ada@x.com")).toBe(true);
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

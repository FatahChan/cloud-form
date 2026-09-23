import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import * as auth from "../src/server/services/auth";
import * as forms from "../src/server/services/forms";
import * as submissions from "../src/server/services/submissions";
import { validateSession } from "../src/server/session";
import type { FormSchema } from "../src/shared/schema";

const EMAIL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOTE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function req(path: string, init: RequestInit = {}, cookie?: string): Request {
  const headers = new Headers(init.headers);
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

describe("importSubmissions", () => {
  it("inserts mapped rows into a published form and rejects unpublished", async () => {
    const { cookie } = await auth.setup(
      { email: "import@x.com", name: "Importer", password: "password1" },
      req("/api/setup", { method: "POST" }),
    );
    const user = await sessionUser(cookie);
    const schema: FormSchema = {
      welcome: { title: "Hi", button: "Go" },
      questions: [
        { type: "email", id: EMAIL, slug: "email", title: "Email", required: true },
        { type: "short_text", id: NOTE, slug: "note", title: "Note", required: false },
      ],
      ending: { title: "Bye" },
    };
    const form = await forms.createForm(user, { title: "Import target", schema });
    await forms.publishForm(user, form.id, true);

    const result = await submissions.importSubmissions(
      user,
      form.id,
      { Email: EMAIL, Note: NOTE },
      [
        { Email: "ada@x.com", Note: "hello" },
        { Email: "bob@x.com", Note: "" },
      ],
    );
    expect(result).toEqual({ ok: true, imported: 2 });

    const inbox = await submissions.listInbox(form.id);
    expect(inbox.submissions).toHaveLength(2);
    expect(inbox.submissions.some((s) => s.email === "ada@x.com" && s.note === "hello")).toBe(true);

    const blocked = await submissions.importSubmissions(user, form.id, { Email: EMAIL }, [{ Email: "not-an-email" }]);
    expect(blocked.ok).toBe(false);

    const draft = await forms.createForm(user, { title: "Draft", schema });
    await expect(submissions.importSubmissions(user, draft.id, { Email: EMAIL }, [{ Email: "ada@x.com" }])).rejects.toMatchObject({
      status: 400,
    });
  });
});

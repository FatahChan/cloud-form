import { insertAudit } from "./audit";
import { authed, err, json, withCookies, env } from "./http";
import { checkPassword, hashPassword, verifyPassword } from "./password";
import {
  clearCookie,
  createSession,
  generateToken,
  hashToken,
  invalidateSession,
  isSecure,
  type SessionUser,
  validateSession,
} from "./session";

export async function userCount(): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
  return row?.n ?? 0;
}

export async function requireUser(request: Request): Promise<{ user: SessionUser; setCookie?: string } | Response> {
  const s = await validateSession(env.DB, request);
  if (!s) return err("Unauthorized", 401);
  return s;
}

export { authed };

export async function handleSetupNeeded(): Promise<Response> {
  return json({ needed: (await userCount()) === 0 });
}

export async function handleSetup(request: Request): Promise<Response> {
  if ((await userCount()) > 0) return err("Already set up", 409);
  const body = (await request.json().catch(() => null)) as { email?: string; name?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase() ?? "";
  const name = body?.name?.trim() ?? "";
  const pwErr = checkPassword(body?.password);
  if (!email || !email.includes("@")) return err("Valid email required", 400);
  if (!name || name.length > 80) return err("Name required", 400);
  if (pwErr) return err(pwErr, 400);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'owner', ?)",
  )
    .bind(id, email, name, await hashPassword(body!.password!), Date.now())
    .run();
  await insertAudit({ actorId: id, action: "user.setup", entityType: "user", entityId: id });
  const { cookie } = await createSession(env.DB, id, isSecure(request));
  return withCookies(json({ ok: true }), [cookie]);
}

export async function handleLogin(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase() ?? "";
  const user = await env.DB.prepare("SELECT id, password_hash FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string; password_hash: string }>();
  if (!user || !body?.password || !(await verifyPassword(body.password, user.password_hash))) {
    return err("Invalid email or password", 401);
  }
  const { cookie } = await createSession(env.DB, user.id, isSecure(request));
  return withCookies(json({ ok: true }), [cookie]);
}

export async function handleLogout(request: Request): Promise<Response> {
  await invalidateSession(env.DB, request);
  return withCookies(json({ ok: true }), [clearCookie(isSecure(request))]);
}

export async function handleMe(request: Request): Promise<Response> {
  const s = await requireUser(request);
  if (s instanceof Response) return s;
  return authed(json({ user: s.user }), s.setCookie);
}

export async function handleInvite(request: Request): Promise<Response> {
  const s = await requireUser(request);
  if (s instanceof Response) return s;
  const token = generateToken();
  await env.DB.prepare(
    "INSERT INTO invites (id, token_hash, created_by, expires_at) VALUES (?, ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), hashToken(token), s.user.id, Date.now() + 7 * 24 * 60 * 60 * 1000)
    .run();
  await insertAudit({ actorId: s.user.id, action: "user.invite", entityType: "invite" });
  return authed(json({ url: `/join/${token}` }), s.setCookie);
}

export async function handleJoin(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    token?: string;
    name?: string;
    password?: string;
    email?: string;
  } | null;
  const token = body?.token?.trim() ?? "";
  const name = body?.name?.trim() ?? "";
  const pwErr = checkPassword(body?.password);
  if (!token) return err("Token required", 400);
  if (!name || name.length > 80) return err("Name required", 400);
  if (pwErr) return err(pwErr, 400);
  const inv = await env.DB.prepare("SELECT id, expires_at, used_at FROM invites WHERE token_hash = ?")
    .bind(hashToken(token))
    .first<{ id: string; expires_at: number; used_at: number | null }>();
  if (!inv || inv.used_at || inv.expires_at < Date.now()) return err("Invite expired or used", 400);
  const id = crypto.randomUUID();
  const emailRaw = body?.email?.trim().toLowerCase() ?? "";
  const email = emailRaw.includes("@") ? emailRaw : `admin-${id.slice(0, 8)}@local`;
  try {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'admin', ?)",
      ).bind(id, email, name, await hashPassword(body!.password!), Date.now()),
      env.DB.prepare("UPDATE invites SET used_at = ? WHERE id = ?").bind(Date.now(), inv.id),
    ]);
  } catch {
    return err("Could not join", 400);
  }
  await insertAudit({ actorId: id, action: "user.join", entityType: "user", entityId: id });
  const { cookie } = await createSession(env.DB, id, isSecure(request));
  return withCookies(json({ ok: true }), [cookie]);
}

export async function handleUsers(request: Request): Promise<Response> {
  const s = await requireUser(request);
  if (s instanceof Response) return s;
  const { results } = await env.DB.prepare("SELECT id, email, name, role, created_at FROM users ORDER BY created_at").all();
  return authed(json({ users: results }), s.setCookie);
}

export async function handleAudit(request: Request): Promise<Response> {
  const s = await requireUser(request);
  if (s instanceof Response) return s;
  const limit = Math.min(50, Number(new URL(request.url).searchParams.get("limit") ?? 50) || 50);
  const { results } = await env.DB.prepare(
    "SELECT id, actor_id, action, entity_type, entity_id, meta, created_at FROM audit_log ORDER BY created_at DESC LIMIT ?",
  )
    .bind(limit)
    .all();
  return authed(json({ events: results }), s.setCookie);
}

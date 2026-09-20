import { insertAudit } from "../audit";
import { HttpError } from "../errors";
import { env } from "../http";
import { checkPassword, hashPassword, verifyPassword } from "../password";
import {
  clearCookie,
  createSession,
  generateToken,
  hashToken,
  invalidateSession,
  isSecure,
  type SessionUser,
} from "../session";

export async function userCount(): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
  return row?.n ?? 0;
}

export function setupNeeded() {
  return userCount().then((n) => ({ needed: n === 0 }));
}

export async function setup(
  input: { email?: string; name?: string; password?: string },
  request: Request,
): Promise<{ cookie: string }> {
  if ((await userCount()) > 0) throw new HttpError("Already set up", 409);
  const email = input.email?.trim().toLowerCase() ?? "";
  const name = input.name?.trim() ?? "";
  const pwErr = checkPassword(input.password);
  if (!email || !email.includes("@")) throw new HttpError("Valid email required", 400);
  if (!name || name.length > 80) throw new HttpError("Name required", 400);
  if (pwErr) throw new HttpError(pwErr, 400);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'owner', ?)",
  )
    .bind(id, email, name, await hashPassword(input.password!), Date.now())
    .run();
  await insertAudit({ actorId: id, action: "user.setup", entityType: "user", entityId: id });
  const { cookie } = await createSession(env.DB, id, isSecure(request));
  return { cookie };
}

export async function login(
  input: { email?: string; password?: string },
  request: Request,
): Promise<{ cookie: string }> {
  const email = input.email?.trim().toLowerCase() ?? "";
  const user = await env.DB.prepare("SELECT id, password_hash FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string; password_hash: string }>();
  if (!user || !input.password || !(await verifyPassword(input.password, user.password_hash))) {
    throw new HttpError("Invalid email or password", 401);
  }
  const { cookie } = await createSession(env.DB, user.id, isSecure(request));
  return { cookie };
}

export async function logout(request: Request): Promise<{ cookie: string }> {
  await invalidateSession(env.DB, request);
  return { cookie: clearCookie(isSecure(request)) };
}

export function me(user: SessionUser) {
  return { user };
}

export async function createInvite(user: SessionUser) {
  const token = generateToken();
  await env.DB.prepare("INSERT INTO invites (id, token_hash, created_by, expires_at) VALUES (?, ?, ?, ?)")
    .bind(crypto.randomUUID(), hashToken(token), user.id, Date.now() + 7 * 24 * 60 * 60 * 1000)
    .run();
  await insertAudit({ actorId: user.id, action: "user.invite", entityType: "invite" });
  return { url: `/join/${token}` };
}

export async function join(
  input: { token?: string; name?: string; password?: string; email?: string },
  request: Request,
): Promise<{ cookie: string }> {
  const token = input.token?.trim() ?? "";
  const name = input.name?.trim() ?? "";
  const pwErr = checkPassword(input.password);
  if (!token) throw new HttpError("Token required", 400);
  if (!name || name.length > 80) throw new HttpError("Name required", 400);
  if (pwErr) throw new HttpError(pwErr, 400);
  const inv = await env.DB.prepare("SELECT id, expires_at, used_at FROM invites WHERE token_hash = ?")
    .bind(hashToken(token))
    .first<{ id: string; expires_at: number; used_at: number | null }>();
  if (!inv || inv.used_at || inv.expires_at < Date.now()) throw new HttpError("Invite expired or used", 400);
  const id = crypto.randomUUID();
  const emailRaw = input.email?.trim().toLowerCase() ?? "";
  const email = emailRaw.includes("@") ? emailRaw : `admin-${id.slice(0, 8)}@local`;
  try {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'admin', ?)",
      ).bind(id, email, name, await hashPassword(input.password!), Date.now()),
      env.DB.prepare("UPDATE invites SET used_at = ? WHERE id = ?").bind(Date.now(), inv.id),
    ]);
  } catch {
    throw new HttpError("Could not join", 400);
  }
  await insertAudit({ actorId: id, action: "user.join", entityType: "user", entityId: id });
  const { cookie } = await createSession(env.DB, id, isSecure(request));
  return { cookie };
}

export async function listUsers() {
  const { results } = await env.DB.prepare(
    "SELECT id, email, name, role, created_at FROM users ORDER BY created_at",
  ).all();
  return { users: results };
}

export async function listAudit(limit: number) {
  const { results } = await env.DB.prepare(
    `SELECT a.id, u.email AS actor, a.action, a.entity_type, a.entity_id, f.title AS entity, a.meta, a.created_at
     FROM audit_log a
     LEFT JOIN users u ON u.id = a.actor_id
     LEFT JOIN forms f ON a.entity_type = 'form' AND f.id = a.entity_id
     ORDER BY a.created_at DESC LIMIT ?`,
  )
    .bind(limit)
    .all();
  return { events: results };
}

import { sha256 } from "@oslojs/crypto/sha2";
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from "@oslojs/encoding";

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_IF_REMAINING_MS = 15 * 24 * 60 * 60 * 1000;

export function generateToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return encodeBase32LowerCaseNoPadding(bytes);
}

export function hashToken(token: string): string {
  return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
}

export function formPublicSlug(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return encodeBase32LowerCaseNoPadding(bytes).slice(0, 8);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin";
};

function cookie(token: string, expiresAt: number, secure: boolean): string {
  const parts = [
    `sid=${token}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${Math.floor((expiresAt - Date.now()) / 1000)}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearCookie(secure: boolean): string {
  const parts = ["sid=", "HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function cookieFromRequest(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

export async function createSession(
  db: D1Database,
  userId: string,
  secure: boolean,
): Promise<{ cookie: string }> {
  const token = generateToken();
  const id = hashToken(token);
  const expiresAt = Date.now() + SESSION_MS;
  await db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").bind(id, userId, expiresAt).run();
  return { cookie: cookie(token, expiresAt, secure) };
}

export async function validateSession(
  db: D1Database,
  request: Request,
): Promise<{ user: SessionUser; setCookie?: string } | null> {
  const token = cookieFromRequest(request, "sid");
  if (!token) return null;
  const id = hashToken(token);
  const row = await db
    .prepare(
      `SELECT s.id AS sid, s.expires_at AS expires_at, u.id, u.email, u.name, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    )
    .bind(id)
    .first<{ sid: string; expires_at: number; id: string; email: string; name: string; role: "owner" | "admin" }>();
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
    return null;
  }
  const user: SessionUser = { id: row.id, email: row.email, name: row.name, role: row.role };
  const remaining = row.expires_at - Date.now();
  if (remaining < REFRESH_IF_REMAINING_MS) {
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
    const next = await createSession(db, user.id, isSecure(request));
    return { user, setCookie: next.cookie };
  }
  return { user };
}

export async function invalidateSession(db: D1Database, request: Request): Promise<void> {
  const token = cookieFromRequest(request, "sid");
  if (!token) return;
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(hashToken(token)).run();
}

export function isSecure(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}

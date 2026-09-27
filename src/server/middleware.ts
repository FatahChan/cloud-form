import { createMiddleware } from "@tanstack/react-start";
import { env } from "./http";
import { validateSession, type SessionUser } from "./session";

export type AuthedContext = {
  user: SessionUser;
  sessionCookie?: string;
};

export const authMiddleware = createMiddleware().server(async ({ request, next }) => {
  const session = await validateSession(env.DB, request);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await next({
    context: { user: session.user, sessionCookie: session.setCookie },
  });
  if (session.setCookie) {
    const headers = new Headers(result.response.headers);
    headers.append("Set-Cookie", session.setCookie);
    result.response = new Response(result.response.body, {
      status: result.response.status,
      statusText: result.response.statusText,
      headers,
    });
  }
  return result;
});

// ponytail: per-IP only, and CF counts per location, so a distributed botnet slips past.
// Upgrade path: also key AUTH_LIMITER by email once lockout-by-attacker is acceptable, or add Turnstile.
export function rateLimit(limiter: "AUTH_LIMITER" | "PUBLIC_LIMITER") {
  return createMiddleware().server(async ({ request, next }) => {
    const key = request.headers.get("cf-connecting-ip") ?? "unknown";
    const { success } = await env[limiter].limit({ key });
    if (!success) {
      return Response.json(
        { error: "Too many requests. Try again in a minute." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
    return next();
  });
}

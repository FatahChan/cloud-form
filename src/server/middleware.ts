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

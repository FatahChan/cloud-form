import { env } from "cloudflare:workers";

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, { status, headers });
}

export function err(message: string, status: number, extra?: HeadersInit): Response {
  return json({ error: message }, status, extra);
}

export function withCookies(res: Response, cookies: string[]): Response {
  const h = new Headers(res.headers);
  for (const c of cookies) h.append("Set-Cookie", c);
  return new Response(res.body, { status: res.status, headers: h });
}

export { env };

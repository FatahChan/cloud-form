import { HttpError } from "./errors";
import { json } from "./http";

export async function readJson<T>(request: Request): Promise<T | null> {
  return (await request.json().catch(() => null)) as T | null;
}

export async function run(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
}

export function serve(fn: () => Promise<unknown> | unknown): Promise<Response> {
  return run(async () => json(await fn()));
}

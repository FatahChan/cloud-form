import { HttpError } from "./errors";

/**
 * Reject cross-site state-changing requests. Browsers send Origin on POST/PUT/DELETE (Referer as a
 * fallback); requests with neither come from non-browser clients, which can't ride a victim's cookie.
 */
export function assertSameOrigin(request: Request): void {
  const expected = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin && origin !== "null") {
    if (origin !== expected) throw new HttpError("Cross-origin request blocked", 403);
    return;
  }
  const referer = request.headers.get("referer");
  if (referer) {
    let refOrigin: string | null = null;
    try {
      refOrigin = new URL(referer).origin;
    } catch {
      /* treat as mismatch */
    }
    if (refOrigin !== expected) throw new HttpError("Cross-origin request blocked", 403);
    return;
  }
  if (origin === "null") throw new HttpError("Cross-origin request blocked", 403);
}

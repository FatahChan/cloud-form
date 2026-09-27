import { env } from "./http";

const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

/** Deletes uploads that were never attached to a submission. Runs from the hourly cron in src/server.ts. */
export async function sweepPending(bucket: R2Bucket, now = Date.now()): Promise<number> {
  let deleted = 0;
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: "pending/", cursor });
    const stale = page.objects.filter((o) => now - o.uploaded.getTime() > PENDING_TTL_MS).map((o) => o.key);
    if (stale.length) await bucket.delete(stale);
    deleted += stale.length;
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return deleted;
}

export async function putPending(key: string, bytes: Uint8Array, mime: string, filename: string): Promise<void> {
  await env.FILES.put(key, bytes, {
    httpMetadata: { contentType: mime },
    customMetadata: { filename },
  });
}

export async function copyPending(pendingKey: string, destKey: string): Promise<R2ObjectBody | null> {
  const obj = await env.FILES.get(pendingKey);
  if (!obj) return null;
  await env.FILES.put(destKey, obj.body, {
    httpMetadata: obj.httpMetadata,
    customMetadata: obj.customMetadata,
  });
  return obj;
}

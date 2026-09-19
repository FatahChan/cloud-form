import { env } from "./http";

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

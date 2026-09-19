import { env } from "./http";

export async function insertAudit(opts: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  meta?: unknown;
}): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO audit_log (id, actor_id, action, entity_type, entity_id, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      crypto.randomUUID(),
      opts.actorId,
      opts.action,
      opts.entityType,
      opts.entityId ?? null,
      opts.meta === undefined ? null : JSON.stringify(opts.meta),
      Date.now(),
    )
    .run();
}

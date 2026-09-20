declare module "cloudflare:test" {
  export function applyD1Migrations(db: D1Database, migrations: unknown): Promise<void>;
}

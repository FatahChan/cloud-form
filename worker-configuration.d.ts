declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
  }
}
interface Env extends Cloudflare.Env {}
declare module "cloudflare:workers" {
  export const env: Cloudflare.Env;
}

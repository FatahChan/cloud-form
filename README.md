# Cloud Form

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/FatahChan/cloud-form)

Typeform-style form builder that runs as one Cloudflare Worker. Clone, log in to Wrangler, deploy. D1 and R2 are created on first deploy. No extra secrets or dashboards.

**Project site:** [fatahchan.github.io/cloud-form](https://fatahchan.github.io/cloud-form) — React landing plus `/examples/<template>` players (schema only, no Worker).

## One-click deploy

Use [**Deploy to Cloudflare**](https://deploy.workers.cloudflare.com/?url=https://github.com/FatahChan/cloud-form) to:

1. Fork this repo into your GitHub account
2. Provision **D1** and **R2** from `wrangler.jsonc`
3. Build and deploy with **Workers Builds** (CI on push to `main`)

After the first deploy succeeds, open your Worker URL and visit **`/admin/setup`** to create the owner account. No Wrangler CLI required for this path.

Docs: [Deploy to Cloudflare buttons](https://developers.cloudflare.com/workers/platform/deploy-buttons/) · [Changelog](https://developers.cloudflare.com/changelog/post/2025-04-08-deploy-to-cloudflare-button/)

## Run (manual)

```bash
git clone https://github.com/FatahChan/cloud-form.git
cd cloud-form
npm install
npx wrangler login
npm run deploy
```

- `npm run dev` — apply local D1 migrations, then Vite on port 3000
- `npm run site` — static landing + example players (no Cloudflare)
- `npm run deploy` — build, deploy the Worker, apply remote D1 migrations
- `npm test` — Worker flow test (publish DDL, file rules, email column lookup)

First visit `/admin/setup` to create the owner. Invite others from **Team** (copy the link). Public forms live at `/f/<slug>`.

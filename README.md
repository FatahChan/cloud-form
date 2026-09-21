# Cloud Form

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/FatahChan/cloud-form)

Typeform-style form builder that runs as one Cloudflare Worker. Clone, log in to Wrangler, deploy. D1 and R2 are created on first deploy. No extra secrets or dashboards.

**Project site:** [cloudform.fatahchan.dev](https://cloudform.fatahchan.dev) — landing and in-browser example players (static Worker, no database). Your own deploy is the form app only: `/admin` and `/f/<slug>`.

## One-click deploy

Use [**Deploy to Cloudflare**](https://deploy.workers.cloudflare.com/?url=https://github.com/FatahChan/cloud-form) to:

1. Fork this repo into your GitHub account
2. Provision **D1** and **R2** from `wrangler.jsonc`
3. Build and deploy with **Workers Builds** (CI on push to `main`)

After the first deploy succeeds, open your Worker URL — it sends you to **`/admin/setup`** to create the owner account. No Wrangler CLI required for this path.

Docs: [Deploy to Cloudflare buttons](https://developers.cloudflare.com/workers/platform/deploy-buttons/) · [Changelog](https://developers.cloudflare.com/changelog/post/2025-04-08-deploy-to-cloudflare-button/)

## Run (manual)

```bash
git clone https://github.com/FatahChan/cloud-form.git
cd cloud-form
npm install
npx wrangler login
npm run deploy
```

- `npm run dev` — apply local D1 migrations, then the app on port 3000
- `npm run site` — local marketing site (landing + examples, no Cloudflare)
- `npm run deploy` — build and deploy the form app Worker
- `npm run deploy:site` — deploy the marketing site to `cloudform.fatahchan.dev`
- `npm test` — Worker flow test (publish DDL, file rules, email column lookup)

First visit `/admin/setup` to create the owner. Invite others from **Team** (copy the link). Public forms live at `/f/<slug>`.

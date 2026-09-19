# Cloud Form

Typeform-style form builder that runs as one Cloudflare Worker. Clone, log in to Wrangler, deploy. D1 and R2 are created on first deploy. No extra secrets or dashboards.

## Run

```bash
git clone <this-repo>
cd cloud-form
npm install
npx wrangler login
npm run deploy
```

- `npm run dev` — apply local D1 migrations, then Vite on port 3000
- `npm run deploy` — build, deploy the Worker, apply remote D1 migrations
- `npm test` — Worker flow test (publish DDL, file rules, email column lookup)

First visit `/admin/setup` to create the owner. Invite others from **Team** (copy the link). Public forms live at `/f/<slug>`.

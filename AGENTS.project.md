# PlanitService

This folder is the live product at **planitservice.com**, not a Grok Build
preview app. `Agents.md` is the Grok Build sandbox contract (Linux, PGLite,
Vercel, port 8080). Do not follow it for deploy, database, or “leave a preview
server running.”

## Pipeline

1. Edit in this local folder (`C:\PlanItService2026`).
2. Commit product changes. Never commit `planitservicesecrets.txt`.
3. Push `main` to GitHub `planittour-code/planitservice`.
4. Netlify builds that commit (`NETLIFY=true`, `DATABASE_URL` from the Netlify
   UI, publish `dist`) and serves https://planitservice.com.

Do not zip/API-publish to Netlify except to restore a down site. Do not deploy
to Vercel. Do not treat PGLite as production.

## Stack that is live

- Host: Netlify site `planitservice` (`ea95c44b-fc11-4bed-8366-846feed2d32a`)
- Database: Postgres via `DATABASE_URL` (Supabase pooler). The `neon` label in
  `src/lib/db.ts` only means “Postgres when DATABASE_URL is set.”
- Billing: Stripe Checkout + Customer Portal (SAQ A). No card fields on our pages.
- Auth: Better Auth. Keep the Grok PWA injector and auth.grok.me Google/X broker
  unless the user asked to change auth.

## Build

- `npm run build` = `vite build && npm run db:migrate`
- Nitro preset is always `netlify` (see `vite.config.ts`)
- PGLite stays in the tree only so local `npm run dev` can run without
  `DATABASE_URL`. Production must have `DATABASE_URL`.

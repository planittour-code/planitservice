# Map-10 demo (P0 §4)

Authenticated Portfolio walkthrough for sales / Loom. **No public write.**  
Shareable route after login: `/manage` (Property Record: `/manage/$id`).

## Product checklist confirmation

| Item | Status |
|------|--------|
| `isManageBaseKind` gates trial + `portfolio_signup_started` to `manage_monthly` \| `manage_annual` only | **Already live** in `src/lib/housefile/stripe.server.ts` (not reinvented here) |
| Invite-shop discoverability on Portfolio home + Property Record | This PR |
| Reply-to-book secondary CTA (no dead “Show me with my addresses”) | This PR |
| 11th house without extras → upgrade / extra-slot UI | **Already live** on `/manage/add` (`needExtra`) |

## Sales credentials

| Field | Value |
|-------|--------|
| Email | `demo.map10@planitservice.com` |
| Password | `Map10-Demo-2026!` (override with `MAP10_DEMO_PASSWORD`) |
| After sign-in | `/manage` — 10 mapped addresses, entitled (`paid_at` set, **no Stripe ids**) |

## Reseed

Requires Postgres `DATABASE_URL` (Netlify / staging Supabase). Does **not** run against PGLite.

```bash
DATABASE_URL=... npm run demo:seed-map10
# or
DATABASE_URL=... node scripts/seed-map10-demo.mjs
```

Seed reads `scripts/map10-houses.json` (10 addresses + 1–2 job stubs each). Idempotent: replaces the ten `prop_map10_*` houses and job stubs on the demo office. Clears Stripe customer/subscription ids on that portfolio so the demo never implies a live charge.

## Happy path (Loom)

1. Sign in with the credentials above → `/manage`.
2. See 10 addresses (“By owner”).
3. Open any house → Property Record with 1–2 prior job stubs.
4. Use **Invite a shop** (Portfolio home one-click, or `#invite-shop` on the record) + **Quote from this history** stub.
5. Optional trial proof on a real trial account: map 2–3 addresses via **Add a house**; invite-shop + estimate affordance on the record.
6. 11th house without extras: **Add a house** → “This portfolio is full” / Stripe extra-slot (test mode only if you proceed).

## Landing CTAs

- Primary: **Start Portfolio** → `/manage/open?intent=up`
- Secondary (interim): reply-to-book copy only — **no** “Show me with my addresses” button until CMO supplies calendar XOR Loom URL.

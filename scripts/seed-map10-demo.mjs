#!/usr/bin/env node
/**
 * P0 §4 Map-10 demo seed — pre-entitled Portfolio with 10 placeholder addresses.
 * Usage: DATABASE_URL=... npm run demo:seed-map10
 * See docs/MAP10-DEMO.md for sales credentials. No Stripe charges.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { hashPassword } from "better-auth/crypto";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[map10] DATABASE_URL is required (Postgres). Not for PGLite.");
  process.exit(1);
}

const DEMO_USER_ID = "user_map10_demo";
const DEMO_EMAIL = "demo.map10@planitservice.com";
const DEMO_PASSWORD = process.env.MAP10_DEMO_PASSWORD || "Map10-Demo-2026!";
const DEMO_NAME = "Map-10 Demo Office";
const DEMO_PORTFOLIO_ID = "portfolio_map10_demo";
const HOUSEHOLD = "co_household";
const DEMO_SHOP = "co_demo";

const HOUSES = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "map10-houses.json"), "utf8"),
);

function token(prefix, n) {
  return `${prefix}-map10-${String(n).padStart(2, "0")}`;
}

async function main() {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const now = new Date().toISOString();

  try {
    await client.query("BEGIN");
    await client.query(
      `insert into companies (id, user_id, name, trade, email)
       values ($1, $2, $3, $4, null) on conflict (id) do nothing`,
      [HOUSEHOLD, "system-household", "PlanitService Household", "household"],
    );
    await client.query(
      `insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
       values ($1, $2, $3, true, $4::timestamptz, $4::timestamptz)
       on conflict (id) do update set
         name = excluded.name, email = excluded.email,
         "emailVerified" = true, "updatedAt" = excluded."updatedAt"`,
      [DEMO_USER_ID, DEMO_NAME, DEMO_EMAIL, now],
    );
    const emailOwner = await client.query(
      `select id from "user" where lower(email) = lower($1)`,
      [DEMO_EMAIL],
    );
    if (emailOwner.rows[0]?.id !== DEMO_USER_ID) {
      throw new Error(`Email ${DEMO_EMAIL} already used by ${emailOwner.rows[0]?.id}`);
    }
    await client.query(`delete from account where "userId" = $1 and "providerId" = 'credential'`, [
      DEMO_USER_ID,
    ]);
    await client.query(
      `insert into account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       values ($1, $2, 'credential', $3, $4, $5::timestamptz, $5::timestamptz)`,
      ["acct_map10_demo", DEMO_EMAIL, DEMO_USER_ID, passwordHash, now],
    );
    const existingPf = await client.query(`select id from portfolios where user_id = $1 limit 1`, [
      DEMO_USER_ID,
    ]);
    const portfolioId = existingPf.rows[0]?.id || DEMO_PORTFOLIO_ID;
    if (existingPf.rows[0]) {
      await client.query(
        `update portfolios set name = $2, paid_at = coalesce(paid_at, $3::timestamptz),
           included_count = 10, stripe_customer_id = null, stripe_subscription_id = null
         where id = $1`,
        [portfolioId, DEMO_NAME, now],
      );
    } else {
      await client.query(
        `insert into portfolios (id, user_id, name, paid_at, extra_slots, included_count, created_at)
         values ($1, $2, $3, $4::timestamptz, 0, 10, $4::timestamptz)`,
        [portfolioId, DEMO_USER_ID, DEMO_NAME, now],
      );
    }
    await client.query(
      `insert into portfolio_members (id, portfolio_id, user_id, email, role)
       values ($1, $2, $3, $4, 'owner')
       on conflict (portfolio_id, email) do update set user_id = excluded.user_id, role = 'owner'`,
      ["pm_map10_demo", portfolioId, DEMO_USER_ID, DEMO_EMAIL],
    );
    const ids = HOUSES.map((h) => h.id);
    await client.query(`delete from portfolio_properties where portfolio_id = $1`, [portfolioId]);
    await client.query(`delete from properties where id = any($1::text[])`, [ids]);
    const shopExists = await client.query(`select 1 from companies where id = $1`, [DEMO_SHOP]);
    const companyId = shopExists.rowCount ? DEMO_SHOP : HOUSEHOLD;
    let n = 1;
    for (const house of HOUSES) {
      await client.query(
        `insert into properties (
           id, company_id, share_token, invite_token, invite_status,
           address_line, city, state, zip, homeowner_name, homeowner_email, notes
         ) values ($1,$2,$3,$4,'pending',$5,$6,$7,$8,$9,'',$10)`,
        [
          house.id, HOUSEHOLD, token("share", n), token("invite", n),
          house.address, house.city, house.state, house.zip, house.owner,
          "Map-10 demo placeholder. Thin history for quote-from-last-job story.",
        ],
      );
      await client.query(
        `insert into portfolio_properties (portfolio_id, property_id) values ($1, $2)`,
        [portfolioId, house.id],
      );
      for (const job of house.jobs) {
        await client.query(
          `insert into jobs (id, company_id, property_id, proposal_id, title, summary, completed_at)
           values ($1, $2, $3, null, $4, $5, $6::date)`,
          [job.id, companyId, house.id, job.title, job.summary, job.when],
        );
      }
      n += 1;
    }
    await client.query("COMMIT");
    console.log("[map10] Seeded entitled demo Portfolio with 10 addresses.");
    console.log(`[map10] Sign in: ${DEMO_EMAIL}`);
    console.log(`[map10] Password: ${DEMO_PASSWORD}`);
    console.log("[map10] Route: /manage (authenticated). No Stripe charges.");
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* keep */ }
    console.error("[map10] failed:", err?.message || err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();

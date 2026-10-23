// Verifies migrations/0064_enable_rls_flagged_tables.sql on PGLite with
// Supabase-like roles:
//  - app_owner: non-superuser, NO bypassrls, owns every table (applies all
//    migrations). Stands in for the DATABASE_URL role; proves RLS without
//    FORCE does not block the owner. (Prod's postgres also has BYPASSRLS.)
//  - anon / authenticated: get Supabase's default grants before 0064, then
//    must be unable to select/insert/update/delete on the 17 tables.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const TABLES = [
  "work_kits",
  "work_kit_items",
  "portfolios",
  "portfolio_properties",
  "portfolio_billing_events",
  "portfolio_members",
  "file_work_invites",
  "analytics_events",
  "user_profiles",
  "shop_billing_events",
  "profile_slug_aliases",
  "shop_slug_aliases",
  "shop_bookings",
  "maintenance_removed",
  "proposal_sends",
  "proposal_events",
  "property_warranties",
];

async function setup() {
  const db = new PGlite({ extensions: { pg_trgm, unaccent } });
  await db.exec(`
    create role app_owner login nosuperuser nobypassrls;
    create role anon nologin; create role authenticated nologin;
    grant all on schema public to app_owner;
    create extension if not exists pg_trgm; create extension if not exists unaccent;
  `);
  await db.exec("set role app_owner");
  await db.exec(
    "create table _migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const before = files.filter((f) => f < "0064");
  const rest = files.filter((f) => f >= "0064");
  for (const f of before) await db.exec(await readFile(join(dir, f), "utf8"));
  // Supabase grants anon/authenticated everything on new public tables by default.
  await db.exec(`
    grant usage on schema public to anon, authenticated;
    grant all on all tables in schema public to anon, authenticated;
  `);
  for (const f of rest) await db.exec(await readFile(join(dir, f), "utf8"));
  return db;
}

async function cols(db, t) {
  const r = await db.query(
    `select column_name from information_schema.columns where table_schema='public' and table_name=$1 limit 1`,
    [t],
  );
  return r.rows[0].column_name;
}

test("0064: RLS on, not forced, owned by app_owner, no policies", async () => {
  const db = await setup();
  const r = await db.query(
    `select c.relname, c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner) owner,
       (select count(*) from pg_policies p where p.tablename=c.relname)::int pols
     from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relname = any($1)`,
    [TABLES],
  );
  assert.equal(r.rows.length, 17);
  for (const row of r.rows) {
    assert.equal(row.relrowsecurity, true, row.relname);
    assert.equal(row.relforcerowsecurity, false, row.relname);
    assert.equal(row.owner, "app_owner", row.relname);
    assert.equal(row.pols, 0, row.relname);
  }
});

test("0064: owner role can still read and write every table", async () => {
  const db = await setup();
  for (const t of TABLES) {
    await db.query(`select * from public.${t} limit 1`);
    // Write path: savepointed DML that touches no rows still checks RLS/privs.
    const c = await cols(db, t);
    await db.query(`update public.${t} set ${c} = ${c} where false`);
    await db.query(`delete from public.${t} where false`);
  }
  // Real insert + read-back through a table with simple required columns.
  await db
    .exec(
      `insert into public.analytics_events (id, name, event_key) values ('00000000-0000-4000-8000-000000000001', 'rls_probe', 'rls_probe')`,
    )
    .catch(async () => {
      const r = await db.query(
        `select column_name, is_nullable, column_default from information_schema.columns where table_name='analytics_events'`,
      );
      throw new Error("analytics_events insert failed; cols=" + JSON.stringify(r.rows));
    });
  const got = await db.query(
    `select count(*)::int n from public.analytics_events where name='rls_probe'`,
  );
  assert.equal(got.rows[0].n, 1);
});

for (const role of ["anon", "authenticated"]) {
  test(`0064: ${role} cannot select/insert/update/delete`, async () => {
    const db = await setup();
    await db.exec(
      "insert into public.analytics_events (id, name, event_key) values ('00000000-0000-4000-8000-000000000002', 'secret', 'secret')",
    );
    const first = {};
    for (const t of TABLES) first[t] = await cols(db, t);
    await db.exec(`set role ${role}`);
    for (const t of TABLES) {
      for (const sql of [
        `select * from public.${t}`,
        `insert into public.${t} default values`,
        `update public.${t} set ${first[t]} = null`,
        `delete from public.${t}`,
      ]) {
        await assert.rejects(db.query(sql), /permission denied/, `${role}: ${sql}`);
      }
    }
  });

  test(`0064: ${role} still sees nothing if grants come back (RLS deny-all)`, async () => {
    const db = await setup();
    await db.exec(
      "insert into public.analytics_events (id, name, event_key) values ('00000000-0000-4000-8000-000000000002', 'secret', 'secret')",
    );
    await db.exec(`grant all on all tables in schema public to ${role}`);
    await db.exec(`set role ${role}`);
    for (const t of TABLES) {
      const r = await db.query(`select count(*)::int n from public.${t}`);
      assert.equal(r.rows[0].n, 0, `${role} read ${t}`);
      await assert.rejects(
        db.query(`insert into public.${t} default values`),
        /row-level security|null value|violates/,
        t,
      );
    }
    await assert.rejects(
      db.query(
        `insert into public.analytics_events (id, name, event_key) values ('00000000-0000-4000-8000-000000000003', 'x', 'x')`,
      ),
      /row-level security/,
    );
    const u = await db.query(`update public.analytics_events set name='x'`);
    assert.equal(u.affectedRows ?? 0, 0);
    const d = await db.query(`delete from public.analytics_events`);
    assert.equal(d.affectedRows ?? 0, 0);
  });
}

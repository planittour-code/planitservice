// PGLite test for migrations/0061_backfill_member_user_ids.sql.
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "migrations");
const MIGRATION = "0061_backfill_member_user_ids.sql";
let pg;
let backfill;

async function user(id, email) {
  await pg.query(`insert into "user" (id, name, email, "emailVerified") values ($1, $1, $2, true)`, [id, email]);
}
async function member(id, companyId, email, userId = null) {
  await pg.query(`insert into company_members (id, company_id, email, user_id) values ($1, $2, $3, $4)`, [id, companyId, email, userId]);
}
async function userIdOf(id) {
  return (await pg.query(`select user_id from company_members where id = $1`, [id])).rows[0].user_id;
}

before(async () => {
  pg = new PGlite({ extensions: { pg_trgm, unaccent } });
  await pg.waitReady;
  const files = (await readdir(dir)).filter((x) => x.endsWith(".sql")).sort();
  assert.ok(files.includes(MIGRATION));
  // Apply everything before 0061, seed, then run 0061 explicitly.
  for (const f of files.filter((x) => x < MIGRATION)) await pg.exec(await readFile(join(dir, f), "utf8"));
  backfill = await readFile(join(dir, MIGRATION), "utf8");

  for (const id of ["co_m1", "co_m2"]) {
    await pg.query(`insert into companies (id, user_id, name) values ($1, 'owner_' || $1, $1) on conflict (id) do nothing`, [id]);
  }
  await user("u_single", "Single@Example.com");
  await user("u_amb1", "dup@example.com");
  await user("u_amb2", "DUP@example.com"); // differs only by case -> ambiguous
  await user("u_house", "house@example.com");
  await user("u_set", "set@example.com");
  await user("u_coll", "coll@example.com");
  await user("u_twice", "twice@example.com");

  await member("m_single", "co_m1", "single@example.com");
  await member("m_amb", "co_m1", "Dup@Example.com");
  await member("m_house", "co_household", "house@example.com");
  await member("m_set", "co_m1", "set@example.com", "u_other");
  // u_coll is already linked to co_m2 through another row.
  await member("m_coll_linked", "co_m2", "coll-alias@example.com", "u_coll");
  await member("m_coll", "co_m2", "coll@example.com");
  // Two null rows in one company that would both claim u_twice.
  await member("m_twice1", "co_m2", "twice@example.com");
  await member("m_twice2", "co_m2", "TWICE@example.com");
  // Same user in a different company is fine.
  await member("m_single_other_co", "co_m2", "SINGLE@example.com");

  await pg.exec(backfill);
});

test("single unambiguous match is filled (case-insensitive)", async () => {
  assert.equal(await userIdOf("m_single"), "u_single");
  assert.equal(await userIdOf("m_single_other_co"), "u_single");
});

test("ambiguous email is skipped", async () => {
  assert.equal(await userIdOf("m_amb"), null);
});

test("household rows are skipped", async () => {
  assert.equal(await userIdOf("m_house"), null);
});

test("already-set user_id is unchanged", async () => {
  assert.equal(await userIdOf("m_set"), "u_other");
});

test("constraint collisions are skipped", async () => {
  assert.equal(await userIdOf("m_coll"), null);
  assert.equal(await userIdOf("m_coll_linked"), "u_coll");
  assert.equal(await userIdOf("m_twice1"), null);
  assert.equal(await userIdOf("m_twice2"), null);
  // Would hold under a (company_id, user_id) unique index.
  const dupes = await pg.query(
    `select company_id, user_id from company_members where user_id is not null group by 1, 2 having count(*) > 1`,
  );
  assert.equal(dupes.rows.length, 0);
});

test("re-running is a no-op", async () => {
  const snap = async () => (await pg.query(`select id, user_id from company_members order by id`)).rows;
  const before = await snap();
  await pg.exec(backfill);
  assert.deepEqual(await snap(), before);
});

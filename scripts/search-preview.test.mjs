// PGLite tests for /api/search-preview scoping (Sprint 1 #3, AC 3.3).
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { searchPreview } from "../src/lib/housefile/search-preview.server.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let sql;

function toSql(run) {
  const fn = async (strings, ...values) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return run(text, values);
  };
  fn.query = (text, params = []) => run(text, params);
  return fn;
}

const shopA = { userId: "pv_ua", companyId: "pv_co_a", surface: "shop" };
const shopB = { userId: "pv_ub", companyId: "pv_co_b", surface: "shop" };
const ho = { userId: "pv_uho", companyId: null, surface: "home" };
const pm = { userId: "pv_upm", companyId: null, surface: "manage" };
const staff = { userId: "pv_ustaff", companyId: null, surface: "manage" };
const stranger = { userId: "pv_ux", companyId: null, surface: "home" };

async function property(id, companyId, address, homeownerUserId = null) {
  await sql`insert into properties (id, share_token, invite_token, company_id, address_line, city, state, zip, homeowner_name, homeowner_email, homeowner_phone, homeowner_user_id)
            values (${id}, ${"pst_" + id}, ${"pit_" + id}, ${companyId}, ${address}, 'Springfield', 'IL', '62701', 'Pat Lee', 'pat@example.com', '555-0100', ${homeownerUserId})`;
}
async function proposal(id, companyId, propertyId, title, status = "sent") {
  await sql`insert into proposals (id, company_id, property_id, share_token, title, status)
            values (${id}, ${companyId}, ${propertyId}, ${"tok_" + id}, ${title}, ${status})`;
}
async function job(id, companyId, propertyId, title) {
  await sql`insert into jobs (id, company_id, property_id, title, completed_at)
            values (${id}, ${companyId}, ${propertyId}, ${title}, '2026-09-01')`;
}
const titles = (p) => [...p.open_estimates.map((e) => e.title), ...p.recent_jobs.map((j) => j.title)].sort();

before(async () => {
  const pg = new PGlite({ extensions: { pg_trgm, unaccent }, parsers: { 1082: (v) => v } });
  await pg.waitReady;
  const dir = join(root, "migrations");
  for (const f of (await readdir(dir)).filter((x) => x.endsWith(".sql")).sort()) {
    await pg.exec(await readFile(join(dir, f), "utf8"));
  }
  sql = toSql(async (text, params) => (await pg.query(text, params)).rows);

  for (const [id, u] of [["pv_co_a", "pv_ua"], ["pv_co_b", "pv_ub"]]) {
    await sql`insert into companies (id, user_id, name) values (${id}, ${u}, ${id})`;
  }
  await property("pv_prop_a", "pv_co_a", "40 Oak Ave");
  await property("pv_prop_b", "pv_co_b", "40 Oak Ave");
  await proposal("pv_pr_a", "pv_co_a", "pv_prop_a", "A open estimate");
  await proposal("pv_pr_a_done", "pv_co_a", "pv_prop_a", "A accepted estimate", "accepted");
  await job("pv_job_a", "pv_co_a", "pv_prop_a", "A job");
  await proposal("pv_pr_b", "pv_co_b", "pv_prop_b", "B secret estimate");

  // Homeowner's own row (household company) with jobs copied from both shops.
  await property("pv_prop_ho", "co_household", "40 Oak Ave", "pv_uho");
  await job("pv_job_a_ho", "pv_co_a", "pv_prop_ho", "A job on HO row");
  await job("pv_job_b_ho", "pv_co_b", "pv_prop_ho", "B job on HO row");

  // Paid portfolio with one mapped row; an unpaid one that grants nothing.
  await property("pv_prop_pm", "co_household", "9 Elm St");
  await job("pv_job_pm", "pv_co_a", "pv_prop_pm", "A job on PM row");
  await sql`insert into portfolios (id, user_id, name, paid_at) values ('pv_pf', 'pv_upm', 'PM', now())`;
  await sql`insert into portfolio_members (id, portfolio_id, user_id, email) values ('pv_pfm', 'pv_pf', 'pv_ustaff', 'staff@example.com')`;
  await sql`insert into portfolio_properties (portfolio_id, property_id) values ('pv_pf', 'pv_prop_pm')`;
  await property("pv_prop_unpaid", "co_household", "11 Elm St");
  await sql`insert into portfolios (id, user_id, name) values ('pv_pf_unpaid', 'pv_ux', 'Unpaid')`;
  await sql`insert into portfolio_properties (portfolio_id, property_id) values ('pv_pf_unpaid', 'pv_prop_unpaid')`;
});

test("shop sees its own property: fields, open estimates only, jobs, last activity", async () => {
  const p = await searchPreview(sql, shopA, "pv_prop_a");
  assert.equal(p.property.address_line, "40 Oak Ave");
  assert.equal(p.property.homeowner_email, "pat@example.com");
  assert.deepEqual(p.open_estimates.map((e) => e.id), ["pv_pr_a"]);
  assert.deepEqual(p.recent_jobs.map((j) => j.id), ["pv_job_a"]);
  assert.ok(p.last_activity_at);
  assert.equal(p.open_work_orders, null);
  assert.equal(p.unpaid_invoices, null);
});

test("cross-tenant: shop B cannot preview shop A's property (same address)", async () => {
  assert.equal(await searchPreview(sql, shopB, "pv_prop_a"), null);
  assert.equal(await searchPreview(sql, shopA, "pv_prop_b"), null);
  const b = await searchPreview(sql, shopB, "pv_prop_b");
  assert.deepEqual(titles(b), ["B secret estimate"]);
});

test("shop cannot preview a homeowner's row even with its own job copied onto it", async () => {
  assert.equal(await searchPreview(sql, shopA, "pv_prop_ho"), null);
  assert.equal(await searchPreview(sql, shopA, "pv_prop_pm"), null);
});

test("homeowner sees every job on their own row, nothing else", async () => {
  const p = await searchPreview(sql, ho, "pv_prop_ho");
  assert.deepEqual(titles(p), ["A job on HO row", "B job on HO row"]);
  assert.equal(await searchPreview(sql, ho, "pv_prop_a"), null);
  assert.equal(await searchPreview(sql, ho, "pv_prop_pm"), null);
});

test("portfolio owner and staff see mapped rows; unpaid / unmapped grant nothing", async () => {
  assert.deepEqual(titles(await searchPreview(sql, pm, "pv_prop_pm")), ["A job on PM row"]);
  assert.deepEqual(titles(await searchPreview(sql, staff, "pv_prop_pm")), ["A job on PM row"]);
  assert.equal(await searchPreview(sql, stranger, "pv_prop_unpaid"), null);
  assert.equal(await searchPreview(sql, pm, "pv_prop_ho"), null);
  await sql`delete from portfolio_properties where property_id = 'pv_prop_pm'`;
  assert.equal(await searchPreview(sql, pm, "pv_prop_pm"), null);
  await sql`insert into portfolio_properties (portfolio_id, property_id) values ('pv_pf', 'pv_prop_pm')`;
});

test("unknown, empty, oversized and injection-shaped ids return null", async () => {
  for (const id of ["nope", "", "x".repeat(500), "' or 1=1 --"]) {
    assert.equal(await searchPreview(sql, shopA, id), null);
    assert.equal(await searchPreview(sql, stranger, id), null);
  }
});

test("preview route: 401 signed out, 400 missing id, 404 out of scope", async () => {
  const src = await readFile(join(root, "src/routes/api/search-preview.ts"), "utf8");
  assert.match(src, /UnauthorizedError\) return json\(\{ error: "unauthorized" \}, 401\)/);
  assert.match(src, /property_id required" \}, 400\)/);
  assert.match(src, /not found" \}, 404\)/);
  assert.match(src, /resolveSearchViewer/);
});

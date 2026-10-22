// Sprint 1 #2 search API: scoping, ranking, normalization and collapse against
// PGLite with every migration (0058 triggers keep search_documents fresh).
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { addressKey } from "../src/lib/housefile/address-claim.ts";
import {
  emailQuery,
  parseSearchType,
  phoneDigits,
  resolveSearchViewer,
  searchDocuments,
} from "../src/lib/housefile/search.server.ts";

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

const shopA = { userId: "u_a", companyId: "co_a", surface: "shop" };
const shopB = { userId: "u_b", companyId: "co_b", surface: "shop" };
const ho = { userId: "u_ho", companyId: null, surface: "home" };
const pm = { userId: "u_pm", companyId: null, surface: "manage" };
const pmStaff = { userId: "u_staff", companyId: null, surface: "manage" };
const stranger = { userId: "u_x", companyId: null, surface: "home" };
const search = (viewer, q, type = null) => searchDocuments(sql, viewer, q, type, { addressKey });
const ids = (hits) => hits.map((h) => h.id);

async function company(id, userId) {
  await sql`insert into companies (id, user_id, name) values (${id}, ${userId}, ${id}) on conflict (id) do nothing`;
}
async function property(id, companyId, address, extra = {}) {
  await sql`
    insert into properties (id, company_id, share_token, invite_token, address_line, city, state, zip,
      homeowner_name, homeowner_email, homeowner_phone, homeowner_user_id)
    values (${id}, ${companyId}, ${`s_${id}`}, ${`i_${id}`}, ${address}, ${"Springfield"}, ${"IL"},
      ${extra.zip ?? "62704"}, ${extra.name ?? ""}, ${extra.email ?? ""}, ${extra.phone ?? ""},
      ${extra.homeownerUserId ?? null})`;
}
async function proposal(id, companyId, propertyId, title) {
  await sql`insert into proposals (id, company_id, property_id, share_token, title)
            values (${id}, ${companyId}, ${propertyId}, ${`st_${id}`}, ${title})`;
}
async function job(id, companyId, propertyId, title, proposalId = null) {
  await sql`insert into jobs (id, company_id, property_id, proposal_id, title, summary, completed_at)
            values (${id}, ${companyId}, ${propertyId}, ${proposalId}, ${title}, ${"Filed on accept"}, current_date)`;
}

before(async () => {
  const pg = new PGlite({ extensions: { pg_trgm, unaccent }, parsers: { 20: Number, 1082: (v) => v } });
  await pg.waitReady;
  const dir = join(root, "migrations");
  for (const f of (await readdir(dir)).filter((x) => x.endsWith(".sql")).sort()) {
    await pg.exec(await readFile(join(dir, f), "utf8"));
  }
  sql = toSql(async (text, params) => (await pg.query(text, params)).rows);

  await company("co_a", "u_a");
  await company("co_b", "u_b");
  // Both shops quoted the same address for the same homeowner.
  await property("prop_a", "co_a", "40 Oak Ave", { name: "José Núñez", email: "Jose@Example.com", phone: "(555) 123-4567" });
  await property("prop_b", "co_b", "40 Oak Ave", { name: "José Núñez", email: "jose@example.com", phone: "555-123-4567" });
  await proposal("pr_a", "co_a", "prop_a", "Seamless gutters");
  await proposal("pr_b", "co_b", "prop_b", "Exterior paint secretb");
  // Household row for the same address, claimed by the homeowner; shop A's
  // accepted job is copied onto it (writeAcceptedWorkToFiles).
  await property("prop_ho", "co_household", "40 Oak Avenue", { name: "José Núñez", homeownerUserId: "u_ho" });
  await job("job_a_on_ho", "co_a", "prop_ho", "Gutters installed", "pr_a");
  await job("job_a", "co_a", "prop_a", "Gutters installed", "pr_a");
  await job("job_b_on_ho", "co_b", "prop_ho", "Paint touch-up secretb");

  // Portfolio (paid) with one property + a staff member; an unpaid one too.
  await sql`insert into portfolios (id, user_id, name, paid_at) values ('pfo_1', 'u_pm', 'Acme PM', now())`;
  await sql`insert into portfolio_members (id, portfolio_id, user_id, email) values ('pm_m', 'pfo_1', 'u_staff', 'staff@acme.example')`;
  await sql`insert into portfolios (id, user_id, name) values ('pf_unpaid', 'u_x', 'Unpaid')`;
  await property("prop_pm", "co_household", "9 Elm St", { name: "Tenant Unit" });
  await sql`insert into portfolio_properties (portfolio_id, property_id) values ('pfo_1', 'prop_pm')`;
  await job("job_a_on_pm", "co_a", "prop_pm", "Gutter cleaning");
  await property("prop_unpaid", "co_household", "11 Elm St");
  await sql`insert into portfolio_properties (portfolio_id, property_id) values ('pf_unpaid', 'prop_unpaid')`;

  // Ranking fixtures for shop A.
  await property("prop_m77", "co_a", "77 Maple Ct");
  await property("prop_mperson", "co_a", "5 Birch Rd", { name: "Maple Johnson" });
  await proposal("pr_m77", "co_a", "prop_mperson", "Maple trim repaint");
  // Duplicate row for one address in shop A (quoted twice).
  await property("prop_dup1", "co_a", "300 Pine Lane", { zip: "62704" });
  await property("prop_dup2", "co_a", "300 Pine Ln", { zip: "62704-1234" });
  await job("job_dup2", "co_a", "prop_dup2", "Pine job");
});

test("helpers: phone, email and type parsing", () => {
  assert.equal(phoneDigits("(555) 123-4567"), "5551234567");
  assert.equal(phoneDigits("+1 555.123.4567"), "5551234567");
  assert.equal(phoneDigits("oak 55"), null);
  assert.equal(emailQuery(" Jose@Example.com "), "jose@example.com");
  assert.equal(parseSearchType("Job"), "job");
  assert.equal(parseSearchType(""), null);
  assert.equal(parseSearchType("invoice"), "invalid");
});

test("cross-tenant: shop A never sees shop B's docs, even at the same address", async () => {
  for (const q of ["oak", "40 Oak Ave", "jose", "José Núñez", "5551234567", "(555) 123-4567",
                   "jose@example.com", "pr_b", "prop_b", "secretb", "paint", ""]) {
    const hits = await search(shopA, q);
    for (const h of hits) {
      assert.notEqual(h.id, "prop_b");
      assert.notEqual(h.id, "pr_b");
      assert.notEqual(h.id, "job_b_on_ho");
      assert.notEqual(h.id, "prop_ho");
      assert.notEqual(h.id, "job_a_on_ho", "shop's copy on the household row stays on that row");
    }
    const b = await search(shopB, q);
    for (const h of b) assert.ok(!h.id.includes("_a") && !h.id.startsWith("prop_m77"), `shop B leaked ${h.id} for "${q}"`);
  }
  // Exact-id queries for the other shop's records return none of them.
  assert.ok(!ids(await search(shopB, "pr_a")).some((id) => ["pr_a", "prop_a", "job_a"].includes(id)));
  assert.ok(!ids(await search(shopA, "pr_b")).some((id) => ["pr_b", "prop_b"].includes(id)));
});

test("homeowner sees jobs copied onto their own row, not the shop's rows", async () => {
  const hits = await search(ho, "gutters");
  assert.deepEqual(ids(hits), ["job_a_on_ho"]);
  assert.equal(hits[0].url, "/home/prop_ho");
  const all = ids(await search(ho, "oak"));
  assert.ok(all.includes("prop_ho"));
  for (const leak of ["prop_a", "prop_b", "pr_a", "pr_b", "job_a"]) assert.ok(!all.includes(leak), leak);
  // Entitlement is the property row, never the shop: B's job on the HO row is visible to the HO...
  assert.deepEqual(ids(await search(ho, "secretb")), ["job_b_on_ho"]);
  // ...and the HO's household row is not visible to shop A through job_a_on_ho's company_id.
  assert.ok(!ids(await search(shopA, "40 oak avenue")).includes("prop_ho"));
  assert.deepEqual(ids(await search(stranger, "gutters")), []);
});

test("portfolio: owner and staff see their mapped rows via portfolio_properties; unpaid sees nothing", async () => {
  assert.deepEqual(ids(await search(pm, "elm")), ["prop_pm"]);
  assert.deepEqual(ids(await search(pmStaff, "gutter cleaning")), ["job_a_on_pm"]);
  assert.equal((await search(pm, "elm"))[0].url, "/manage/prop_pm");
  assert.deepEqual(ids(await search(stranger, "elm")), []);
  // A forged portfolio_id on the doc must not grant access (not trusted).
  await sql`update search_documents set portfolio_id = 'pfo_1' where ref_id = 'prop_a'`;
  assert.ok(!ids(await search(pm, "oak")).includes("prop_a"));
  await sql`update search_documents set portfolio_id = null where ref_id = 'prop_a'`;
  // Removing the mapping revokes access immediately.
  await sql`delete from portfolio_properties where property_id = 'prop_pm'`;
  assert.deepEqual(ids(await search(pm, "elm")), []);
  await sql`insert into portfolio_properties (portfolio_id, property_id) values ('pfo_1', 'prop_pm')`;
});

test("ranking: exact id > address > person > other", async () => {
  const hits = await search(shopA, "maple");
  assert.deepEqual(ids(hits).slice(0, 3), ["prop_m77", "prop_mperson", "pr_m77"]);
  assert.deepEqual(hits.slice(0, 3).map((h) => h.match), ["address", "person", "text"]);
  const exact = await search(shopA, "PR_M77");
  assert.equal(exact[0].id, "pr_m77");
  assert.equal(exact[0].match, "id");
  assert.equal(exact[0].url, "/app/proposals/pr_m77");
  // fuzzy address
  assert.equal((await search(shopA, "77 mapel ct"))[0].id, "prop_m77");
});

test("phone, email and accents match regardless of format", async () => {
  for (const q of ["5551234567", "(555) 123-4567", "555.123.4567", "+1 555 123 4567", "123-4567"]) {
    const hits = await search(shopA, q);
    assert.equal(hits[0]?.id, "prop_a", q);
    assert.equal(hits[0].match, "person", q);
  }
  assert.equal((await search(shopA, "JOSE@example.com"))[0].id, "prop_a");
  assert.equal((await search(shopA, "jose nunez"))[0].id, "prop_a");
  assert.deepEqual(ids(await search(shopA, "jose", "person")), ["prop_a"]);
});

test("special characters never error", async () => {
  for (const q of ["%", "_", "'", "\\", "a:*", "!&|()", "<script>", "o'brien & sons", "100%", "''; drop table x;--", "🙂"]) {
    const hits = await search(shopA, q);
    assert.ok(Array.isArray(hits), q);
  }
  assert.deepEqual(ids(await search(shopA, "%")), []);
});

test("same-address property rows collapse to one hit (prefers the row with jobs)", async () => {
  const hits = (await search(shopA, "300 pine")).filter((h) => h.type === "property");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, "prop_dup2");
});

test("type filter, max 20, empty q returns 10 most recent", async () => {
  const jobs = await search(shopA, "gutter", "job");
  assert.ok(jobs.length > 0 && jobs.every((h) => h.type === "job"));
  for (let i = 0; i < 25; i += 1) await property(`prop_bulk${i}`, "co_a", `${100 + i} Bulk Way`);
  assert.equal((await search(shopA, "bulk")).length, 20);
  const recent = await search(shopA, "");
  assert.equal(recent.length, 10);
  assert.ok(recent.every((h) => h.match === "recent"));
  assert.ok(ids(recent).includes("prop_bulk24"));
  assert.ok(ids(recent).every((id) => !["prop_b", "pr_b"].includes(id)));
});

test("resolveSearchViewer: shop owner, member, PM and homeowner", async () => {
  await sql`insert into company_members (id, company_id, user_id, email) values ('m_b', 'co_b', 'u_bcrew', 'crew@b.example')`;
  assert.deepEqual(await resolveSearchViewer(sql, "u_a"), { userId: "u_a", companyId: "co_a", surface: "shop" });
  assert.equal((await resolveSearchViewer(sql, "u_bcrew")).companyId, "co_b");
  assert.equal((await resolveSearchViewer(sql, "u_pm")).surface, "manage");
  assert.deepEqual(await resolveSearchViewer(sql, "u_ho"), { userId: "u_ho", companyId: null, surface: "home" });
});

test("route: 401 when signed out, 400 on unknown type, scoping delegated to SQL", async () => {
  const src = await readFile(join(root, "src/routes/api/search.ts"), "utf8");
  assert.match(src, /createFileRoute\("\/api\/search"\)/);
  assert.match(src, /UnauthorizedError\) return json\(\{ error: "unauthorized" \}, 401\)/);
  assert.match(src, /unknown type" \}, 400/);
  assert.doesNotMatch(src, /\.filter\(/);
});

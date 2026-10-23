// Sprint 1 #1 search index: migration applies on PGLite, triggers keep
// search_documents fresh, backfill is idempotent, and tenants never mix.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { backfillSearch } from "./backfill-search.mjs";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
let pg;
const q = async (t, p) => (await pg.query(t, p)).rows;
const db = {
  query: (t, p) => pg.query(t, p),
  transaction: async (fn) => {
    await pg.exec("begin");
    try {
      await fn();
      await pg.exec("commit");
    } catch (e) {
      await pg.exec("rollback");
      throw e;
    }
  },
};

async function addCompany(id) {
  await q(`insert into companies (id, user_id, name) values ($1, $2, $3)`, [id, `u_${id}`, id]);
}
async function addProperty(id, company, extra = {}) {
  await q(
    `insert into properties (id, company_id, share_token, invite_token, address_line, city, state, zip,
       homeowner_name, homeowner_email, homeowner_phone)
     values ($1,$2,$3,$4,$5,'Springfield','IL','62704',$6,$7,$8)`,
    [id, company, `s_${id}`, `i_${id}`, extra.address ?? "12 Rue Café Lane",
     extra.name ?? "José Núñez", extra.email ?? "Jose@Example.com", extra.phone ?? "(555) 123-4567"],
  );
}

before(async () => {
  pg = new PGlite({ extensions: { pg_trgm, unaccent } });
  await pg.waitReady;
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    await pg.transaction(async (tx) => {
      await tx.exec(await readFile(join(migrationsDir, f), "utf8"));
    });
  }
});

test("migration creates search_documents and immutable f_unaccent", async () => {
  const [{ v }] = await q(`select public.f_unaccent('Café Núñez') v`);
  assert.equal(v, "Cafe Nunez");
  const [{ provolatile }] = await q(`select provolatile from pg_proc where proname = 'f_unaccent'`);
  assert.equal(provolatile, "i");
  const idx = await q(`select indexname from pg_indexes where tablename = 'search_documents'`);
  const names = idx.map((r) => r.indexname);
  for (const n of ["search_documents_tsv_idx", "search_documents_address_trgm_idx", "search_documents_title_trgm_idx"]) {
    assert.ok(names.includes(n), n);
  }
});

test("triggers index property, proposal (+items), job; updates and deletes", async () => {
  await addCompany("co_a");
  await addProperty("prop_a", "co_a");
  await q(`insert into proposals (id, company_id, property_id, share_token, title)
           values ('pr_a','co_a','prop_a','st_pr_a','Gutter replacement')`);
  await q(`insert into proposal_items (id, proposal_id, name) values ('it_a','pr_a','Seamless aluminum gutters')`);
  await q(`insert into jobs (id, company_id, property_id, proposal_id, title, summary, completed_at)
           values ('job_a','co_a','prop_a','pr_a','Gutters installed','Downspouts rerouted', current_date)`);

  const docs = await q(`select doc_type, ref_id, company_id, property_id, phone_norm, email_norm
                        from search_documents where company_id = 'co_a' order by doc_type`);
  assert.deepEqual(docs.map((d) => d.doc_type), ["job", "property", "proposal"]);
  const prop = docs.find((d) => d.doc_type === "property");
  assert.equal(prop.phone_norm, "5551234567");
  assert.equal(prop.email_norm, "jose@example.com");
  assert.ok(docs.every((d) => d.property_id === "prop_a"));

  // accent-insensitive person + item-name FTS, fuzzy address
  const person = await q(`select ref_id from search_documents
    where company_id='co_a' and tsv @@ to_tsquery('simple', public.search_norm('Jose') || ':*')`);
  assert.deepEqual(person.map((r) => r.ref_id), ["prop_a"]);
  const item = await q(`select ref_id from search_documents
    where company_id='co_a' and tsv @@ to_tsquery('simple', 'seamless:*')`);
  assert.deepEqual(item.map((r) => r.ref_id), ["pr_a"]);
  const fuzzy = await q(`select ref_id from search_documents
    where company_id='co_a' and doc_type='property' and address_norm % public.search_norm('12 rue cafe lane springfeld')`);
  assert.deepEqual(fuzzy.map((r) => r.ref_id), ["prop_a"]);

  // update propagates (address -> children), item edits refresh the proposal
  await q(`update properties set address_line = '40 Oak Ave' where id = 'prop_a'`);
  const moved = await q(`select doc_type from search_documents where address_norm like '40 oak ave%' order by doc_type`);
  assert.deepEqual(moved.map((r) => r.doc_type), ["job", "property", "proposal"]);
  await q(`update proposal_items set name = 'Copper gutters' where id = 'it_a'`);
  assert.equal((await q(`select 1 from search_documents where ref_id='pr_a' and tsv @@ to_tsquery('simple','copper')`)).length, 1);

  await q(`delete from jobs where id = 'job_a'`);
  assert.equal((await q(`select 1 from search_documents where ref_id='job_a'`)).length, 0);
});

test("shared address: each shop gets its own doc; company A never appears under company B", async () => {
  await addCompany("co_b");
  await addProperty("prop_b", "co_b", { address: "40 Oak Ave", name: "José Núñez" });
  await q(`insert into proposals (id, company_id, property_id, share_token, title)
           values ('pr_b','co_b','prop_b','st_pr_b','Exterior paint')`);

  const underB = await q(`select ref_id, company_id from search_documents where company_id = 'co_b'`);
  assert.deepEqual(underB.map((r) => r.ref_id).sort(), ["pr_b", "prop_b"]);
  for (const term of ["jose", "oak", "copper", "gutters", "pr_a", "prop_a"]) {
    const hits = await q(
      `select ref_id from search_documents
       where company_id = $1 and (tsv @@ to_tsquery('simple', $2 || ':*') or address_norm % $2)`,
      ["co_b", term],
    );
    assert.ok(hits.every((h) => !["prop_a", "pr_a", "job_a"].includes(h.ref_id)), `leak on "${term}"`);
  }
  const mixed = await q(`select d.ref_id from search_documents d
    left join properties p on p.id = d.property_id
    where d.doc_type = 'property' and d.company_id is distinct from p.company_id`);
  assert.equal(mixed.length, 0);
});

test("backfill is idempotent and covers all rows", async () => {
  await q(`delete from search_documents`);
  const first = await backfillSearch(db, { batchSize: 1, pauseMs: 0 });
  const snap1 = await q(`select doc_type, ref_id, company_id, property_id, title, tsv::text
                         from search_documents order by doc_type, ref_id`);
  const second = await backfillSearch(db, { batchSize: 2, pauseMs: 0 });
  const snap2 = await q(`select doc_type, ref_id, company_id, property_id, title, tsv::text
                         from search_documents order by doc_type, ref_id`);
  assert.deepEqual(first, second);
  assert.deepEqual(snap1, snap2);
  const missing = await q(`
    select 'property' t, id from properties p where not exists (select 1 from search_documents d where d.doc_type='property' and d.ref_id=p.id)
    union all select 'proposal', id from proposals p where not exists (select 1 from search_documents d where d.doc_type='proposal' and d.ref_id=p.id)
    union all select 'job', id from jobs j where not exists (select 1 from search_documents d where d.doc_type='job' and d.ref_id=j.id)`);
  assert.equal(missing.length, 0);
});

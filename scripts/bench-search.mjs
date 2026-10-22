// Sprint 1 #2 (AC 2.5): seed ~100k search docs in PGLite and report p50/p95 of
// searchDocuments() for a mix of real query shapes. PGLite is single-threaded
// WASM, so it's a pessimistic stand-in for Supabase Postgres; rerun against a
// real database with DATABASE_URL-backed tooling if numbers are borderline.
//
//   npm run search:bench            # 100k docs, 200 queries
//   node scripts/bench-search.mjs --docs=100000 --runs=300 --assert   # exit 1 if p95 >= 300ms
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { addressKey } from "../src/lib/housefile/address-claim.ts";
import { searchDocuments } from "../src/lib/housefile/search.server.ts";

const arg = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : dflt;
};
const DOCS = arg("docs", 100_000);
const RUNS = arg("runs", 200);
const SHOPS = 20;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const pg = new PGlite({ extensions: { pg_trgm, unaccent } });
await pg.waitReady;
for (const f of (await readdir(join(root, "migrations"))).filter((x) => x.endsWith(".sql")).sort()) {
  await pg.exec(await readFile(join(root, "migrations", f), "utf8"));
}
const sql = (strings, ...values) => {
  let text = strings[0];
  for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
  return pg.query(text, values).then((r) => r.rows);
};
sql.query = (text, params = []) => pg.query(text, params).then((r) => r.rows);

const t0 = performance.now();
// 30% properties (via the real 0058 trigger), 70% proposal/job docs written
// straight into search_documents in the same shape the triggers produce.
// Shop co_bench_0 is the "big tenant" (40% of everything) so the measured
// shop is the worst case, not an average one.
const props = Math.round(DOCS * 0.3);
const children = DOCS - props;
await pg.exec(`
  insert into companies (id, user_id, name)
  select 'co_bench_' || s, 'u_bench_' || s, 'Bench ' || s from generate_series(0, ${SHOPS - 1}) s;
  create temp table words(i int, w text);
  insert into words values (0,'Oak'),(1,'Maple'),(2,'Pine'),(3,'Elm'),(4,'Birch'),(5,'Cedar'),(6,'Willow'),
    (7,'Spruce'),(8,'Ash'),(9,'Hickory'),(10,'Laurel'),(11,'Magnolia'),(12,'Juniper'),(13,'Aspen'),(14,'Poplar');
  create temp table names(i int, w text);
  insert into names values (0,'José Núñez'),(1,'Pat Smith'),(2,'Alex Kim'),(3,'Sam Lee'),(4,'Jordan Diaz'),
    (5,'Taylor Brown'),(6,'Chris Wong'),(7,'Morgan Patel'),(8,'Casey Nguyen'),(9,'Riley Garcia');
  insert into properties (id, company_id, share_token, invite_token, address_line, city, state, zip,
    homeowner_name, homeowner_email, homeowner_phone)
  select 'bp_' || g,
         'co_bench_' || case when g % 5 < 2 then 0 else 1 + g % ${SHOPS - 1} end,
         'bs_' || g, 'bi_' || g,
         (g % 9000 + 1)::text || ' ' || (select w from words where i = g % 15) || ' ' ||
           (array['St','Ave','Rd','Ln','Ct'])[1 + g % 5],
         (array['Springfield','Austin','Denver','Portland'])[1 + g % 4], 'TX',
         lpad((10000 + g % 800)::text, 5, '0'),
         (select w from names where i = g % 10) || ' ' || g,
         'owner' || g || '@example.com',
         '(555) ' || lpad((g % 1000)::text, 3, '0') || '-' || lpad((g % 10000)::text, 4, '0')
  from generate_series(1, ${props}) g;
  insert into search_documents (doc_type, ref_id, property_id, company_id, title, subtitle, address_norm, tsv, updated_at)
  select case when g % 2 = 0 then 'proposal' else 'job' end,
         'bd_' || g, d.ref_id, d.company_id,
         (array['Seamless gutters','Exterior paint','Roof repair','Gutter guards','Interior paint','Deck stain'])[1 + g % 6]
           || ' ' || g,
         'sent · ' || d.title, d.address_norm,
         setweight(to_tsvector('simple', 'bd_' || g), 'A') ||
         setweight(to_tsvector('simple', lower((array['Seamless gutters','Exterior paint','Roof repair','Gutter guards','Interior paint','Deck stain'])[1 + g % 6])), 'B'),
         now() - (g || ' seconds')::interval
  from generate_series(1, ${children}) g
  join search_documents d on d.doc_type = 'property' and d.ref_id = 'bp_' || (1 + g % ${props});
  analyze;
`);
const [{ c }] = await sql.query(`select count(*)::int c from search_documents where ref_id like 'b%'`);
const [{ big }] = await sql.query(`select count(*)::int big from search_documents where company_id = 'co_bench_0'`);
console.log(`seeded ${c} docs (${big} in the measured shop) in ${((performance.now() - t0) / 1000).toFixed(1)}s`);

const viewer = { userId: "u_bench_0", companyId: "co_bench_0", surface: "shop" };
const explain = process.argv.find((a) => a.startsWith("--explain="))?.slice(10);
if (explain !== undefined) {
  // Print the plan of the main search statement for one query, then exit.
  const spy = (strings, ...values) => sql(strings, ...values);
  spy.query = async (text, params = []) => {
    if (text.includes("with cand")) {
      const plan = await pg.query(`explain (analyze, buffers off) ${text}`, params);
      console.log(plan.rows.map((r) => r["QUERY PLAN"]).join("\n"));
    }
    return sql.query(text, params);
  };
  await searchDocuments(spy, viewer, explain, null, { addressKey });
  process.exit(0);
}
const queries = [
  "oak", "120 maple", "45 Pine Rd", "magnolia ave", "cedr st", "jose", "José Núñez", "pat smith 40",
  "(555) 040-0040", "5550400040", "owner1235@example.com", "owner12", "gutters", "exterior paint",
  "bd_4242", "bp_1000", "deck", "springfield", "", "zzz no match", "100%", "o'brien",
];
for (const q of queries) await searchDocuments(sql, viewer, q, null, { addressKey }); // warm up
const times = [];
const perQuery = new Map();
for (let i = 0; i < RUNS; i += 1) {
  const q = queries[i % queries.length];
  const s = performance.now();
  await searchDocuments(sql, viewer, q, null, { addressKey });
  const ms = performance.now() - s;
  times.push(ms);
  perQuery.set(q, Math.max(perQuery.get(q) ?? 0, ms));
}
times.sort((a, b) => a - b);
const pct = (p) => times[Math.min(times.length - 1, Math.ceil((p / 100) * times.length) - 1)];
const p50 = pct(50);
const p95 = pct(95);
console.log(`runs=${RUNS} p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms max=${times.at(-1).toFixed(1)}ms`);
console.log("slowest queries (max ms):");
for (const [q, ms] of [...perQuery].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
  console.log(`  ${ms.toFixed(1).padStart(7)}  ${JSON.stringify(q)}`);
}
if (process.argv.includes("--assert") && p95 >= 300) {
  console.error(`FAIL: p95 ${p95.toFixed(1)}ms >= 300ms`);
  process.exit(1);
}

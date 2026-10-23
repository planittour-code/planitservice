#!/usr/bin/env node
/**
 * Search index backfill (Sprint 1 #1). Re-indexes properties, proposals and
 * jobs into search_documents by calling the migration's refresh functions.
 *
 * - Batched by primary key: 1000 ids per batch, one short transaction each,
 *   ~100 ms sleep between batches so it never holds long locks.
 * - Idempotent (upsert on (doc_type, ref_id)) and resumable: pass
 *   `--after-<type>=<id>` or just re-run; it starts from the beginning by
 *   default and every re-run produces the same rows.
 * - NEVER run from build or scripts/migrate.mjs. Manual: `npm run search:backfill`.
 */
import { fileURLToPath } from "node:url";

export const TYPES = [
  { type: "property", table: "properties", fn: "search_refresh_property" },
  { type: "proposal", table: "proposals", fn: "search_refresh_proposal" },
  { type: "job", table: "jobs", fn: "search_refresh_job" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {{ query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>,
 *           transaction: (fn: () => Promise<void>) => Promise<void> }} db
 */
export async function backfillSearch(db, opts = {}) {
  const batchSize = opts.batchSize ?? 1000;
  const pauseMs = opts.pauseMs ?? 100;
  const after = opts.after ?? {};
  const log = opts.log ?? (() => {});
  const totals = {};
  for (const { type, table, fn } of TYPES) {
    let cursor = after[type] ?? "";
    let n = 0;
    for (;;) {
      const { rows } = await db.query(
        `select id from ${table} where id > $1 order by id limit $2`,
        [cursor, batchSize],
      );
      if (rows.length === 0) break;
      const ids = rows.map((r) => r.id);
      await db.transaction(async () => {
        await db.query(`select public.${fn}(x) from unnest($1::text[]) as x`, [ids]);
      });
      n += ids.length;
      cursor = ids[ids.length - 1];
      log(`[search:backfill] ${type}: ${n} indexed (resume with --after-${type}=${cursor})`);
      if (rows.length < batchSize) break;
      if (pauseMs) await sleep(pauseMs);
    }
    totals[type] = n;
  }
  return totals;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || !url.trim()) {
    console.error("[search:backfill] DATABASE_URL is required.");
    process.exit(1);
  }
  const after = {};
  for (const a of process.argv.slice(2)) {
    const m = /^--after-(property|proposal|job)=(.+)$/.exec(a);
    if (m) after[m[1]] = m[2];
  }
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const db = {
      query: (t, p) => client.query(t, p),
      transaction: async (fn) => {
        await client.query("begin");
        try {
          await fn();
          await client.query("commit");
        } catch (e) {
          await client.query("rollback");
          throw e;
        }
      },
    };
    const totals = await backfillSearch(db, { after, log: console.log });
    console.log("[search:backfill] done", totals);
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

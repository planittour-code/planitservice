#!/usr/bin/env node
/**
 * Sprint 1 #4 backfill: open one work order for every accepted/completed
 * proposal that has none. Runs OUTSIDE migrate.mjs (not on deploy).
 *
 *   DATABASE_URL=... node scripts/backfill-work-orders.mjs [--batch=200] [--dry-run]
 *
 * Batched (keyset on proposals.id) and idempotent: work_orders.proposal_id is
 * UNIQUE and ensureWorkOrder returns the existing WO, so re-runs are no-ops.
 * Each proposal is its own transaction (number + WO + items + activity row).
 * Does NOT touch jobs / the Property Record.
 * Needs Node >= 22.18 (loads the shared TypeScript module directly).
 */
import { fileURLToPath } from "node:url";
import { ensureWorkOrder } from "../src/lib/housefile/work-orders.ts";

const ACTOR = "System (work order backfill)";

/**
 * @param {*} sql tagged-template SQL (same surface as src/lib/db.ts)
 * @param {{ batchSize?: number, dryRun?: boolean, log?: (m: string) => void, transaction?: (fn: (tx: any) => Promise<unknown>) => Promise<unknown> }} opts
 */
export async function backfillWorkOrders(sql, opts = {}) {
  const batchSize = opts.batchSize ?? 200;
  const log = opts.log ?? console.log;
  const run = opts.transaction ?? ((fn) => fn(sql));
  let after = "";
  let scanned = 0;
  let created = 0;
  for (;;) {
    const rows = await sql`
      select pr.id from proposals pr
      where pr.status in ('accepted', 'completed')
        and pr.id > ${after}
        and not exists (select 1 from work_orders w where w.proposal_id = pr.id)
      order by pr.id
      limit ${batchSize}
    `;
    if (rows.length === 0) break;
    for (const row of rows) {
      scanned += 1;
      if (opts.dryRun) continue;
      const made = await run((tx) => ensureWorkOrder(tx, row.id, ACTOR));
      if (made?.created) created += 1;
    }
    after = rows[rows.length - 1].id;
    log(`[backfill-work-orders] scanned ${scanned}, created ${created}`);
  }
  log(`[backfill-work-orders] done: scanned ${scanned}, created ${created}${opts.dryRun ? " (dry run)" : ""}`);
  return { scanned, created };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("[backfill-work-orders] DATABASE_URL not set");
    process.exit(1);
  }
  const batchArg = process.argv.find((a) => a.startsWith("--batch="));
  const batchSize = batchArg ? Math.max(1, Number(batchArg.split("=")[1]) || 200) : 200;
  const dryRun = process.argv.includes("--dry-run");
  const { default: pg } = await import("pg");
  pg.types.setTypeParser(20, Number);
  pg.types.setTypeParser(1082, (v) => v);
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const wrap = (runner) => {
    const sql = async (strings, ...values) => {
      let text = strings[0];
      for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
      return (await runner.query(text, values)).rows;
    };
    sql.query = async (text, params = []) => (await runner.query(text, params)).rows;
    return sql;
  };
  const transaction = async (fn) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const out = await fn(wrap(client));
      await client.query("COMMIT");
      return out;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  };
  try {
    await backfillWorkOrders(wrap(pool), { batchSize, dryRun, transaction });
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error("[backfill-work-orders] failed", err);
    process.exit(1);
  });
}

// Sprint 1 #4: work orders against a real Postgres (PGLite) with every migration.
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  completeWorkOrderForProposal,
  ensureWorkOrder,
  loadWorkOrderForCompany,
  loadWorkOrderForProposal,
  setWorkOrderStatus,
  syncWorkOrderStartFromProposal,
  updateWorkOrderFields,
  workOrderStatusForProposal,
} from "../src/lib/housefile/work-orders.ts";
import { backfillWorkOrders } from "./backfill-work-orders.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function toSql(run) {
  const sql = async (strings, ...values) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return run(text, values);
  };
  sql.query = (text, params = []) => run(text, params);
  return sql;
}

async function freshDb() {
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v } });
  await pg.waitReady;
  const dir = join(root, "migrations");
  for (const name of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) {
    await pg.exec(await readFile(join(dir, name), "utf8"));
  }
  const sql = toSql(async (text, params) => (await pg.query(text, params)).rows);
  const tx = (fn) =>
    pg.transaction((t) => fn(toSql(async (text, params) => (await t.query(text, params)).rows)));
  return { pg, sql, tx };
}

let n = 0;
async function seedShop(sql, name) {
  const id = `co_${name}_${(n += 1)}`;
  await sql`insert into companies (id, user_id, name, slug) values (${id}, ${`user_${id}`}, ${name}, ${id})`;
  const member = `mem_${id}`;
  await sql`insert into company_members (id, company_id, email, role) values (${member}, ${id}, ${`crew@${id}.example`}, ${"sales"})`;
  return { id, member };
}

async function seedSold(sql, companyId, address, status = "accepted") {
  const propertyId = `prop_${(n += 1)}`;
  await sql`
    insert into properties (id, company_id, share_token, invite_token, address_line, city, state, zip, homeowner_name, homeowner_email)
    values (${propertyId}, ${companyId}, ${`tok_${propertyId}`}, ${`inv_${propertyId}`}, ${address}, ${"Austin"}, ${"TX"}, ${"78701"}, ${"Pat"}, ${"pat@home.example"})
  `;
  const proposalId = `pr_${(n += 1)}`;
  await sql`
    insert into proposals (id, company_id, property_id, share_token, title, status, accepted_at, scheduled_on)
    values (${proposalId}, ${companyId}, ${propertyId}, ${`share_${proposalId}`}, ${"Gutters"}, ${status},
      ${status === "draft" ? null : new Date().toISOString()}, ${status === "draft" ? null : "2026-11-01"})
  `;
  await sql`
    insert into proposal_items (id, proposal_id, sort_order, name, qty, unit, unit_price, included)
    values
      (${`${proposalId}_a`}, ${proposalId}, 1, ${"Seamless gutter"}, 120, ${"lf"}, 9.5, true),
      (${`${proposalId}_b`}, ${proposalId}, 2, ${"Downspout"}, 4, ${"ea"}, 60, true),
      (${`${proposalId}_c`}, ${proposalId}, 3, ${"Gutter guard (declined)"}, 120, ${"lf"}, 4, false)
  `;
  return { propertyId, proposalId };
}

const count = async (sql, text, params) => Number((await sql.query(text, params))[0].c);

test("4.1/4.2 one WO per proposal with a line-item snapshot", async () => {
  const { sql } = await freshDb();
  const shop = await seedShop(sql, "alpha");
  const { proposalId } = await seedSold(sql, shop.id, "1 Main St");
  const first = await ensureWorkOrder(sql, proposalId, "test");
  assert.equal(first.created, true);
  assert.equal(first.workOrder.status, "scheduled");
  assert.equal(first.workOrder.start_date, "2026-11-01");
  assert.equal(first.workOrder.number, 1);
  const again = await ensureWorkOrder(sql, proposalId, "test");
  assert.equal(again.created, false);
  assert.equal(again.workOrder.id, first.workOrder.id);
  assert.equal(await count(sql, "select count(*) c from work_orders where proposal_id = $1", [proposalId]), 1);
  const bundle = await loadWorkOrderForCompany(sql, shop.id, first.workOrder.id);
  assert.deepEqual(bundle.items.map((i) => i.name), ["Seamless gutter", "Downspout"]);
  // Snapshot: later edits to the estimate do not change the WO.
  await sql`update proposal_items set name = ${"Changed"} where proposal_id = ${proposalId}`;
  const after = await loadWorkOrderForCompany(sql, shop.id, first.workOrder.id);
  assert.equal(after.items[0].name, "Seamless gutter");
  // DB backstop: a second row for the same proposal is rejected.
  await assert.rejects(
    sql`insert into work_orders (id, company_id, property_id, proposal_id, number) select 'dup', company_id, property_id, proposal_id, 99 from work_orders where proposal_id = ${proposalId}`,
  );
  // Not sold yet -> no WO.
  const draft = await seedSold(sql, shop.id, "2 Main St", "draft");
  assert.equal(await ensureWorkOrder(sql, draft.proposalId, "test"), null);
});

test("4.3 status flow writes activity rows; illegal moves rejected", async () => {
  const { sql } = await freshDb();
  const shop = await seedShop(sql, "alpha");
  const { proposalId } = await seedSold(sql, shop.id, "1 Main St");
  const { workOrder } = await ensureWorkOrder(sql, proposalId, "test");
  await setWorkOrderStatus(sql, shop.id, workOrder.id, "in_progress", "crew@alpha");
  const started = (await sql`select started_work_at from proposals where id = ${proposalId}`)[0];
  assert.ok(started.started_work_at);
  await assert.rejects(setWorkOrderStatus(sql, shop.id, workOrder.id, "scheduled", "x"), /cannot move/);
  await setWorkOrderStatus(sql, shop.id, workOrder.id, "complete", "crew@alpha");
  await assert.rejects(setWorkOrderStatus(sql, shop.id, workOrder.id, "cancelled", "x"), /cannot move/);
  await assert.rejects(setWorkOrderStatus(sql, shop.id, workOrder.id, "draft", "x"), /Unknown/);
  const { events } = await loadWorkOrderForCompany(sql, shop.id, workOrder.id);
  assert.deepEqual(
    events.filter((e) => e.kind === "status").map((e) => [e.actor, e.from_status, e.to_status]),
    [
      ["crew@alpha", "scheduled", "in_progress"],
      ["crew@alpha", "in_progress", "complete"],
    ],
  );
  const second = await seedSold(sql, shop.id, "3 Main St");
  const wo2 = (await ensureWorkOrder(sql, second.proposalId, "t")).workOrder;
  assert.equal(wo2.number, 2);
  await setWorkOrderStatus(sql, shop.id, wo2.id, "cancelled", "t");
  const p2 = (await sql`select status from proposals where id = ${second.proposalId}`)[0];
  assert.equal(p2.status, "accepted");
});

test("4.4 WO status changes never create or duplicate jobs rows", async () => {
  const { sql } = await freshDb();
  const shop = await seedShop(sql, "alpha");
  const { proposalId, propertyId } = await seedSold(sql, shop.id, "1 Main St");
  // Filing on accept (what writeAcceptedWorkToFiles does) is modeled by one row.
  await sql`insert into jobs (id, company_id, property_id, proposal_id, title, completed_at) values ('job1', ${shop.id}, ${propertyId}, ${proposalId}, 'Gutters', current_date)`;
  const { workOrder } = await ensureWorkOrder(sql, proposalId, "t");
  await updateWorkOrderFields(sql, shop.id, workOrder.id, { startDate: "2026-11-03", endDate: "2026-11-04", notes: "gate code 1234" }, "t");
  await setWorkOrderStatus(sql, shop.id, workOrder.id, "in_progress", "t");
  await setWorkOrderStatus(sql, shop.id, workOrder.id, "complete", "t");
  assert.equal(await count(sql, "select count(*) c from jobs where proposal_id = $1", [proposalId]), 1);
  // Start date mirrors to the legacy scheduled_on column.
  const pr = (await sql`select scheduled_on from proposals where id = ${proposalId}`)[0];
  assert.equal(String(pr.scheduled_on).slice(0, 10), "2026-11-03");
});

test("4.5 proposal completed and WO complete agree from both entry points", async () => {
  const { sql, tx } = await freshDb();
  const shop = await seedShop(sql, "alpha");
  // Entry 1: WO -> complete marks the proposal completed.
  const a = await seedSold(sql, shop.id, "1 Main St");
  const woA = (await ensureWorkOrder(sql, a.proposalId, "t")).workOrder;
  await tx((t) => setWorkOrderStatus(t, shop.id, woA.id, "complete", "t"));
  assert.equal((await sql`select status from proposals where id = ${a.proposalId}`)[0].status, "completed");
  // Entry 2: legacy "mark job complete" (completeProposal) completes the WO, even with no WO yet.
  const b = await seedSold(sql, shop.id, "2 Main St");
  await tx((t) => completeWorkOrderForProposal(t, shop.id, b.proposalId, "t"));
  assert.equal((await sql`select status from proposals where id = ${b.proposalId}`)[0].status, "completed");
  assert.equal((await workOrderStatusForProposal(sql, b.proposalId)).status, "complete");
  // Legacy schedule path mirrors into the WO.
  const c = await seedSold(sql, shop.id, "3 Main St");
  await ensureWorkOrder(sql, c.proposalId, "t");
  await syncWorkOrderStartFromProposal(sql, shop.id, c.proposalId, "2026-12-01", "t");
  assert.equal((await workOrderStatusForProposal(sql, c.proposalId)).start_date, "2026-12-01");
});

test("transaction: a failure after WO creation rolls the WO back", async () => {
  const { sql, tx } = await freshDb();
  const shop = await seedShop(sql, "alpha");
  const { proposalId } = await seedSold(sql, shop.id, "1 Main St");
  await assert.rejects(
    tx(async (t) => {
      await ensureWorkOrder(t, proposalId, "t");
      throw new Error("boom");
    }),
    /boom/,
  );
  assert.equal(await count(sql, "select count(*) c from work_orders where proposal_id = $1", [proposalId]), 0);
});

test("4.6 public status carries no notes or assignee", async () => {
  const { sql } = await freshDb();
  const shop = await seedShop(sql, "alpha");
  const { proposalId } = await seedSold(sql, shop.id, "1 Main St");
  const { workOrder } = await ensureWorkOrder(sql, proposalId, "t");
  await updateWorkOrderFields(sql, shop.id, workOrder.id, { notes: "secret", assignee: "Sam" }, "t");
  const view = await workOrderStatusForProposal(sql, proposalId);
  assert.deepEqual(Object.keys(view).sort(), ["end_date", "number", "start_date", "status"]);
});

test("cross-tenant: shop B cannot read or mutate shop A's WO at the same address", async () => {
  const { sql } = await freshDb();
  const a = await seedShop(sql, "alpha");
  const b = await seedShop(sql, "bravo");
  const soldA = await seedSold(sql, a.id, "500 Shared Ln");
  const soldB = await seedSold(sql, b.id, "500 Shared Ln");
  const woA = (await ensureWorkOrder(sql, soldA.proposalId, "a")).workOrder;
  const woB = (await ensureWorkOrder(sql, soldB.proposalId, "b")).workOrder;
  assert.equal(woA.number, 1);
  assert.equal(woB.number, 1); // numbering is per shop
  await assert.rejects(loadWorkOrderForCompany(sql, b.id, woA.id), /not found/);
  assert.equal(await loadWorkOrderForProposal(sql, b.id, soldA.proposalId), null);
  await assert.rejects(setWorkOrderStatus(sql, b.id, woA.id, "cancelled", "b"), /not found/);
  await assert.rejects(updateWorkOrderFields(sql, b.id, woA.id, { notes: "x" }, "b"), /not found/);
  await assert.rejects(completeWorkOrderForProposal(sql, b.id, soldA.proposalId, "b"), /not found/);
  // B cannot assign A's team member.
  await assert.rejects(updateWorkOrderFields(sql, b.id, woB.id, { assigneeMemberId: a.member }, "b"), /your team/);
  await syncWorkOrderStartFromProposal(sql, b.id, soldA.proposalId, "2027-01-01", "b");
  const fresh = await loadWorkOrderForCompany(sql, a.id, woA.id);
  assert.equal(fresh.workOrder.status, "scheduled");
  assert.equal(fresh.workOrder.notes, null);
  assert.equal(fresh.workOrder.start_date, "2026-11-01");
  assert.equal(fresh.events.length, 1);
  assert.equal((await sql`select status from proposals where id = ${soldA.proposalId}`)[0].status, "accepted");
});

test("backfill: batched, idempotent, maps completed -> complete", async () => {
  const { sql } = await freshDb();
  const shop = await seedShop(sql, "alpha");
  const ids = [];
  for (let i = 0; i < 5; i += 1) ids.push((await seedSold(sql, shop.id, `${i} Oak St`, i === 0 ? "completed" : "accepted")).proposalId);
  await seedSold(sql, shop.id, "9 Oak St", "draft");
  const first = await backfillWorkOrders(sql, { batchSize: 2, log: () => {} });
  assert.equal(first.created, 5);
  const second = await backfillWorkOrders(sql, { batchSize: 2, log: () => {} });
  assert.equal(second.created, 0);
  assert.equal(await count(sql, "select count(*) c from work_orders", []), 5);
  assert.equal((await workOrderStatusForProposal(sql, ids[0])).status, "complete");
  assert.equal(await count(sql, "select count(*) c from work_order_items", []), 10);
});

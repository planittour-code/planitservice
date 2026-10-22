// Sprint 1 #4 (rev: manual create, assignee email, 4.3a mail): work orders against a real Postgres (PGLite) with every migration.
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
  renderWorkOrderAssignmentEmail,
  workOrderStatusForProposal,
} from "../src/lib/housefile/work-orders.ts";

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
const HO = { name: "Patricia Quill", email: "patricia.quill@home.example", phone: "512-555-0199" };

async function seedShop(sql, name) {
  const id = `co_${name}_${(n += 1)}`;
  await sql`insert into companies (id, user_id, name, slug, email) values (${id}, ${`user_${id}`}, ${`${name} Gutters`}, ${id}, ${`office@${id}.example`})`;
  return { id, name: `${name} Gutters` };
}

async function seedSold(sql, companyId, address, status = "accepted") {
  const propertyId = `prop_${(n += 1)}`;
  await sql`
    insert into properties (id, company_id, share_token, invite_token, address_line, city, state, zip, homeowner_name, homeowner_email, homeowner_phone)
    values (${propertyId}, ${companyId}, ${`tok_${propertyId}`}, ${`inv_${propertyId}`}, ${address}, ${"Austin"}, ${"TX"}, ${"78701"}, ${HO.name}, ${HO.email}, ${HO.phone})
  `;
  const proposalId = `pr_${(n += 1)}`;
  await sql`
    insert into proposals (id, company_id, property_id, share_token, title, status, accepted_at, scheduled_on)
    values (${proposalId}, ${companyId}, ${propertyId}, ${`share_${proposalId}`}, ${"Gutters"}, ${status},
      ${status === "draft" ? null : new Date().toISOString()}, ${status === "draft" ? null : "2026-11-01"})
  `;
  await sql`
    insert into proposal_items (id, proposal_id, sort_order, name, description, qty, unit, unit_price, included)
    values
      (${`${proposalId}_a`}, ${proposalId}, 1, ${"Seamless gutter"}, ${"6 in. K-style, white"}, 120, ${"lf"}, 9.5, true),
      (${`${proposalId}_b`}, ${proposalId}, 2, ${"Downspout"}, ${null}, 4, ${"ea"}, 60, true),
      (${`${proposalId}_c`}, ${proposalId}, 3, ${"Gutter guard (declined)"}, ${null}, 120, ${"lf"}, 4, false)
  `;
  return { propertyId, proposalId };
}

const count = async (sql, text, params) => Number((await sql.query(text, params))[0].c);

/** Mock mailer: records every send; optionally fails. */
function mockMailer({ fail = false } = {}) {
  const sent = [];
  const notify = async (email) => {
    if (fail) throw new Error("Resend 503");
    sent.push(email);
  };
  return { sent, notify };
}

function assertNoHomeowner(text) {
  for (const v of [HO.name, "Patricia", HO.email, HO.phone]) assert.ok(!text.includes(v), `leaked ${v}`);
}

test("4.1 manual create: idempotent, one per proposal, line-item snapshot", async () => {
  const { sql } = await freshDb();
  const shop = await seedShop(sql, "alpha");
  const { proposalId } = await seedSold(sql, shop.id, "1 Main St");
  assert.equal(await count(sql, "select count(*) c from work_orders", []), 0);
  const first = await ensureWorkOrder(sql, proposalId, "test");
  assert.equal(first.created, true);
  assert.equal(first.workOrder.status, "scheduled");
  assert.equal(first.workOrder.number, 1);
  assert.equal(first.workOrder.assignee_email, null);
  assert.equal(first.workOrder.show_prices, true); // 4.3b: new WO shows prices by default
  // Duplicate create returns the existing WO.
  const again = await ensureWorkOrder(sql, proposalId, "test");
  assert.equal(again.created, false);
  assert.equal(again.workOrder.id, first.workOrder.id);
  // Concurrent double click: still one.
  await Promise.all([ensureWorkOrder(sql, proposalId, "a"), ensureWorkOrder(sql, proposalId, "b")]);
  assert.equal(await count(sql, "select count(*) c from work_orders where proposal_id = $1", [proposalId]), 1);
  const bundle = await loadWorkOrderForCompany(sql, shop.id, first.workOrder.id);
  assert.deepEqual(bundle.items.map((i) => i.name), ["Seamless gutter", "Downspout"]);
  await sql`update proposal_items set name = ${"Changed"} where proposal_id = ${proposalId}`;
  assert.equal((await loadWorkOrderForCompany(sql, shop.id, first.workOrder.id)).items[0].name, "Seamless gutter");
  await assert.rejects(
    sql`insert into work_orders (id, company_id, property_id, proposal_id, number) select 'dup', company_id, property_id, proposal_id, 99 from work_orders where proposal_id = ${proposalId}`,
  );
  const draft = await seedSold(sql, shop.id, "2 Main St", "draft");
  assert.equal(await ensureWorkOrder(sql, draft.proposalId, "test"), null);
  // Completed proposals can also be opened manually.
  const done = await seedSold(sql, shop.id, "3 Main St", "completed");
  assert.equal((await ensureWorkOrder(sql, done.proposalId, "test")).workOrder.status, "complete");
});

test("accept creates no WO (acceptProposalPublic has no work-order code)", async () => {
  const src = await readFile(join(root, "src/lib/housefile/server.ts"), "utf8");
  const start = src.indexOf("export const acceptProposalPublic");
  const end = src.indexOf("\nexport const ", start + 10);
  const accept = src.slice(start, end);
  assert.ok(start > 0 && accept.length > 200);
  assert.doesNotMatch(accept, /ensureWorkOrder|work_orders|WorkOrder|withTransaction/);
  // And the legacy complete path no longer creates one either.
  const { sql } = await freshDb();
  const shop = await seedShop(sql, "alpha");
  const { proposalId } = await seedSold(sql, shop.id, "1 Main St");
  assert.equal(await completeWorkOrderForProposal(sql, shop.id, proposalId, "t"), null);
  assert.equal(await count(sql, "select count(*) c from work_orders", []), 0);
});

test("4.3 assignee email: validated, lowercased; end < start rejected", async () => {
  const { sql } = await freshDb();
  const shop = await seedShop(sql, "alpha");
  const { proposalId } = await seedSold(sql, shop.id, "1 Main St");
  const { workOrder } = await ensureWorkOrder(sql, proposalId, "t");
  for (const bad of ["sam", "sam@", "@x.com", "sam@x", "sa m@x.com", "a@b@c.com"]) {
    await assert.rejects(updateWorkOrderFields(sql, shop.id, workOrder.id, { assigneeEmail: bad }, "t"), /valid email/);
  }
  const wo = await updateWorkOrderFields(sql, shop.id, workOrder.id, { assigneeEmail: "  Sam.Crew@Example.COM " }, "t");
  assert.equal(wo.assignee_email, "sam.crew@example.com");
  // DB backstop rejects non-lowercase / malformed values written directly.
  await assert.rejects(sql`update work_orders set assignee_email = ${"Sam@X.com"} where id = ${workOrder.id}`);
  await assert.rejects(
    updateWorkOrderFields(sql, shop.id, workOrder.id, { startDate: "2026-11-05", endDate: "2026-11-04" }, "t"),
    /before the start/,
  );
  await assert.rejects(sql`update work_orders set start_date = '2026-11-05', end_date = '2026-11-04' where id = ${workOrder.id}`);
  const ok = await updateWorkOrderFields(sql, shop.id, workOrder.id, { startDate: "2026-11-04", endDate: "2026-11-04" }, "t");
  assert.equal(ok.end_date, "2026-11-04");
  const { events } = await loadWorkOrderForCompany(sql, shop.id, workOrder.id);
  assert.ok(events.some((e) => e.kind === "updated" && /assignee: sam.crew@example.com/.test(e.detail)));
});

test("4.3a assignment email: first set 1, unchanged save 0, case-only 0, change 1 (new address only)", async () => {
  const { sql } = await freshDb();
  const shop = await seedShop(sql, "alpha");
  const { proposalId } = await seedSold(sql, shop.id, "1 Main St");
  const { workOrder } = await ensureWorkOrder(sql, proposalId, "owner@alpha");
  const m = mockMailer();
  const opts = { notify: m.notify };
  await updateWorkOrderFields(sql, shop.id, workOrder.id, { assigneeEmail: "sam@crew.example" }, "o", opts);
  assert.equal(m.sent.length, 1);
  assert.equal(m.sent[0].to, "sam@crew.example");
  await updateWorkOrderFields(sql, shop.id, workOrder.id, { assigneeEmail: "sam@crew.example" }, "o", opts);
  await updateWorkOrderFields(sql, shop.id, workOrder.id, { assigneeEmail: "SAM@crew.example" }, "o", opts);
  await updateWorkOrderFields(sql, shop.id, workOrder.id, { startDate: "2026-11-02", endDate: "2026-11-03", notes: "n" }, "o", opts);
  await updateWorkOrderFields(sql, shop.id, workOrder.id, { showPrices: false }, "o", opts);
  await setWorkOrderStatus(sql, shop.id, workOrder.id, "in_progress", "o");
  assert.equal(m.sent.length, 1);
  await updateWorkOrderFields(sql, shop.id, workOrder.id, { assigneeEmail: "lee@crew.example" }, "o", opts);
  assert.equal(m.sent.length, 2);
  assert.equal(m.sent[1].to, "lee@crew.example");
  assert.ok(!m.sent.slice(1).some((e) => e.to === "sam@crew.example"));
  const { events } = await loadWorkOrderForCompany(sql, shop.id, workOrder.id);
  assert.deepEqual(
    events.filter((e) => e.kind === "notified").map((e) => e.detail),
    ["Assignment email sent to sam@crew.example", "Assignment email sent to lee@crew.example"],
  );
  assert.ok(events.filter((e) => e.kind === "notified").every((e) => e.created_at));
});

test("4.3a/4.3b email content: shop, address, WO number, dates, items; prices ON by default, OFF hides them; no homeowner", async () => {
  const { sql } = await freshDb();
  const shop = await seedShop(sql, "alpha");
  const { proposalId } = await seedSold(sql, shop.id, "77 Elm St");
  const { workOrder } = await ensureWorkOrder(sql, proposalId, "o");
  assert.equal(workOrder.show_prices, true);
  const m = mockMailer();
  await updateWorkOrderFields(
    sql, shop.id, workOrder.id,
    { assigneeEmail: "sam@crew.example", startDate: "2026-11-02", endDate: "2026-11-04" }, "o", { notify: m.notify },
  );
  const on = m.sent[0];
  for (const body of [on.text, on.html]) {
    assert.match(body, /alpha Gutters/);
    assert.match(body, /77 Elm St, Austin, TX 78701/);
    assert.match(body, /WO-0001/);
    assert.match(body, /Nov 2, 2026/);
    assert.match(body, /Nov 4, 2026/);
    assert.match(body, /6 in\. K-style, white/);
    assert.doesNotMatch(body, /declined/);
    assert.match(body, /Seamless gutter \(120 lf\) - \$1,140\.00/);
    assert.match(body, /Downspout \(4 ea\) - \$240\.00/);
    assert.match(body, /Total: \$1,380\.00/);
    assertNoHomeowner(body);
  }
  assertNoHomeowner(on.subject);
  assert.equal(on.shopReplyTo, `office@${shop.id}.example`);
  // Shop turns prices OFF: no email from the toggle; the next assignment email is price-free.
  await updateWorkOrderFields(sql, shop.id, workOrder.id, { showPrices: false }, "o", { notify: m.notify });
  assert.equal(m.sent.length, 1);
  await updateWorkOrderFields(sql, shop.id, workOrder.id, { assigneeEmail: "lee@crew.example" }, "o", { notify: m.notify });
  const off = m.sent[1];
  for (const body of [off.text, off.html]) {
    assert.match(body, /Seamless gutter \(120 lf\)/);
    assert.match(body, /Downspout \(4 ea\)/);
    assert.doesNotMatch(body, /\$|Total|1,140|240/);
    assertNoHomeowner(body);
  }
  assertNoHomeowner(off.subject);
  // Pure renderer (the worker-facing view): default ON, explicit OFF is price-free.
  const base = {
    to: "x@y.example", shopName: "S", shopReplyTo: null, workOrderId: "w", number: 3, address: "1 A St",
    startDate: null, endDate: null, items: [{ name: "Item", qty: 2, unit: "ea", description: null, unit_price: 5 }],
  };
  assert.match(renderWorkOrderAssignmentEmail(base).text, /Total: \$10\.00/);
  assert.doesNotMatch(renderWorkOrderAssignmentEmail({ ...base, showPrices: false }).text, /\$|Total/);
});

test("4.3a a mail failure does not block the save and is logged", async () => {
  const { sql } = await freshDb();
  const shop = await seedShop(sql, "alpha");
  const { proposalId } = await seedSold(sql, shop.id, "1 Main St");
  const { workOrder } = await ensureWorkOrder(sql, proposalId, "o");
  const m = mockMailer({ fail: true });
  const wo = await updateWorkOrderFields(sql, shop.id, workOrder.id, { assigneeEmail: "sam@crew.example" }, "o", { notify: m.notify });
  assert.equal(wo.assignee_email, "sam@crew.example");
  const saved = await loadWorkOrderForCompany(sql, shop.id, workOrder.id);
  assert.equal(saved.workOrder.assignee_email, "sam@crew.example");
  const failed = saved.events.filter((e) => e.kind === "notify_failed");
  assert.equal(failed.length, 1);
  assert.match(failed[0].detail, /sam@crew\.example failed: Resend 503/);
  assert.equal(saved.events.filter((e) => e.kind === "notified").length, 0);
});

test("4.4 status flow writes activity rows; illegal moves rejected", async () => {
  const { sql } = await freshDb();
  const shop = await seedShop(sql, "alpha");
  const { proposalId } = await seedSold(sql, shop.id, "1 Main St");
  const { workOrder } = await ensureWorkOrder(sql, proposalId, "test");
  await setWorkOrderStatus(sql, shop.id, workOrder.id, "in_progress", "crew@alpha");
  assert.ok((await sql`select started_work_at from proposals where id = ${proposalId}`)[0].started_work_at);
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
  assert.equal((await sql`select status from proposals where id = ${second.proposalId}`)[0].status, "accepted");
});

test("4.5 WO changes never create or duplicate jobs rows", async () => {
  const { sql } = await freshDb();
  const shop = await seedShop(sql, "alpha");
  const { proposalId, propertyId } = await seedSold(sql, shop.id, "1 Main St");
  await sql`insert into jobs (id, company_id, property_id, proposal_id, title, completed_at) values ('job1', ${shop.id}, ${propertyId}, ${proposalId}, 'Gutters', current_date)`;
  const { workOrder } = await ensureWorkOrder(sql, proposalId, "t");
  await updateWorkOrderFields(sql, shop.id, workOrder.id, { startDate: "2026-11-03", endDate: "2026-11-04", notes: "gate code 1234" }, "t");
  await setWorkOrderStatus(sql, shop.id, workOrder.id, "in_progress", "t");
  await setWorkOrderStatus(sql, shop.id, workOrder.id, "complete", "t");
  assert.equal(await count(sql, "select count(*) c from jobs where proposal_id = $1", [proposalId]), 1);
  const pr = (await sql`select scheduled_on from proposals where id = ${proposalId}`)[0];
  assert.equal(String(pr.scheduled_on).slice(0, 10), "2026-11-03");
});

test("proposal completed and WO complete agree from both entry points", async () => {
  const { sql, tx } = await freshDb();
  const shop = await seedShop(sql, "alpha");
  const a = await seedSold(sql, shop.id, "1 Main St");
  const woA = (await ensureWorkOrder(sql, a.proposalId, "t")).workOrder;
  await tx((t) => setWorkOrderStatus(t, shop.id, woA.id, "complete", "t"));
  assert.equal((await sql`select status from proposals where id = ${a.proposalId}`)[0].status, "completed");
  const b = await seedSold(sql, shop.id, "2 Main St");
  await ensureWorkOrder(sql, b.proposalId, "t");
  await tx((t) => completeWorkOrderForProposal(t, shop.id, b.proposalId, "t"));
  assert.equal((await sql`select status from proposals where id = ${b.proposalId}`)[0].status, "completed");
  assert.equal((await workOrderStatusForProposal(sql, b.proposalId)).status, "complete");
  const c = await seedSold(sql, shop.id, "3 Main St");
  await ensureWorkOrder(sql, c.proposalId, "t");
  await syncWorkOrderStartFromProposal(sql, shop.id, c.proposalId, "2026-12-01", "t");
  assert.equal((await workOrderStatusForProposal(sql, c.proposalId)).start_date, "2026-12-01");
});

test("transaction: a failure during create rolls the WO back", async () => {
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
  await updateWorkOrderFields(sql, shop.id, workOrder.id, { notes: "secret", assigneeEmail: "sam@crew.example", showPrices: true }, "t");
  const view = await workOrderStatusForProposal(sql, proposalId);
  assert.deepEqual(Object.keys(view).sort(), ["end_date", "number", "start_date", "status"]);
});

test("cross-tenant: shop B cannot read, mutate, or email from shop A's WO at the same address", async () => {
  const { sql } = await freshDb();
  const a = await seedShop(sql, "alpha");
  const b = await seedShop(sql, "bravo");
  const soldA = await seedSold(sql, a.id, "500 Shared Ln");
  const soldB = await seedSold(sql, b.id, "500 Shared Ln");
  const woA = (await ensureWorkOrder(sql, soldA.proposalId, "a")).workOrder;
  const woB = (await ensureWorkOrder(sql, soldB.proposalId, "b")).workOrder;
  assert.equal(woA.number, 1);
  assert.equal(woB.number, 1);
  const m = mockMailer();
  await assert.rejects(loadWorkOrderForCompany(sql, b.id, woA.id), /not found/);
  assert.equal(await loadWorkOrderForProposal(sql, b.id, soldA.proposalId), null);
  await assert.rejects(setWorkOrderStatus(sql, b.id, woA.id, "cancelled", "b"), /not found/);
  await assert.rejects(
    updateWorkOrderFields(sql, b.id, woA.id, { assigneeEmail: "spy@b.example" }, "b", { notify: m.notify }),
    /not found/,
  );
  assert.equal(m.sent.length, 0);
  assert.equal(await completeWorkOrderForProposal(sql, b.id, soldA.proposalId, "b"), null);
  await syncWorkOrderStartFromProposal(sql, b.id, soldA.proposalId, "2027-01-01", "b");
  // B's own assignment email carries only B's shop.
  await updateWorkOrderFields(sql, b.id, woB.id, { assigneeEmail: "crew@b.example" }, "b", { notify: m.notify });
  assert.equal(m.sent.length, 1);
  assert.match(m.sent[0].text, /bravo Gutters/);
  assert.doesNotMatch(m.sent[0].text, /alpha/);
  const fresh = await loadWorkOrderForCompany(sql, a.id, woA.id);
  assert.equal(fresh.workOrder.status, "scheduled");
  assert.equal(fresh.workOrder.assignee_email, null);
  assert.equal(fresh.workOrder.start_date, "2026-11-01");
  assert.equal(fresh.events.length, 1);
  assert.equal((await sql`select status from proposals where id = ${soldA.proposalId}`)[0].status, "accepted");
});

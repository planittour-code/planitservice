// Sprint 1 #5: invoices from work orders against PGLite with every migration.
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import "./ts-resolve.mjs";
// Load src/*.ts after the resolver hook is registered (static imports would
// resolve before it runs).
const { ensureWorkOrder, setWorkOrderStatus } = await import("../src/lib/housefile/work-orders.ts");
const {
  addInvoiceNote,
  ensureInvoiceForWorkOrder,
  invoiceNoProcessingLine,
  invoicePayUrl,
  invoiceSeqLabel,
  invoiceStatusLabel,
  listInvoicesForProperty,
  loadInvoice,
  loadInvoiceForWorkOrder,
  markedPaidLabel,
  markInvoicePaid,
  markInvoiceSent,
  renderInvoiceText,
  retractInvoicePayment,
  updateDraftInvoice,
  voidInvoice,
} = await import("../src/lib/housefile/invoices.ts");
const { paymentInvoiceNumber } = await import("../src/lib/housefile/payment.ts");
const { invoicePaymentCopy } = await import("../src/lib/housefile/invoice.ts");

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
  const pg = new PGlite({ parsers: { 20: Number, 1082: (v) => v }, extensions: { pg_trgm, unaccent } });
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

async function seedShop(sql, name, links = {}) {
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
const ACT = { userId: "user_shop", label: "office@shop.example" };

async function woFor(sql, shop, address, status = "accepted") {
  const s = await seedSold(sql, shop.id, address, status);
  const { workOrder } = await ensureWorkOrder(sql, s.proposalId, "test");
  return { ...s, workOrder };
}

async function sentInvoice(sql, shop, address) {
  const s = await woFor(sql, shop, address);
  const { invoice } = await ensureInvoiceForWorkOrder(sql, shop.id, s.workOrder.id, ACT, { dueDate: "2099-01-01" });
  await markInvoiceSent(sql, shop.id, invoice.id, ACT);
  return { ...s, invoice };
}

test("5.1 create from WO: copies lines, one per WO, idempotent; cancelled WO refused", async () => {
  const { sql } = await freshDb();
  const shop = await seedShop(sql, "alpha");
  const s = await woFor(sql, shop, "1 Main St");
  const a = await ensureInvoiceForWorkOrder(sql, shop.id, s.workOrder.id, ACT);
  assert.equal(a.created, true);
  assert.equal(a.invoice.status, "draft");
  const again = await ensureInvoiceForWorkOrder(sql, shop.id, s.workOrder.id, ACT);
  assert.equal(again.created, false);
  assert.equal(again.invoice.id, a.invoice.id);
  await Promise.all([1, 2].map(() => ensureInvoiceForWorkOrder(sql, shop.id, s.workOrder.id, ACT)));
  assert.equal(await count(sql, "select count(*) c from invoices where work_order_id = $1", [s.workOrder.id]), 1);
  const b = await loadInvoiceForWorkOrder(sql, shop.id, s.workOrder.id);
  assert.deepEqual(b.items.map((i) => i.name), ["Seamless gutter", "Downspout"]);
  assert.equal(b.totals.total, 120 * 9.5 + 4 * 60);
  assert.equal(b.totals.amountDue, b.totals.total);
  // Complete WO can be invoiced; cancelled cannot.
  const done = await woFor(sql, shop, "2 Main St", "completed");
  assert.equal((await ensureInvoiceForWorkOrder(sql, shop.id, done.workOrder.id, ACT)).created, true);
  const c = await woFor(sql, shop, "3 Main St");
  await setWorkOrderStatus(sql, shop.id, c.workOrder.id, "cancelled", "test");
  await assert.rejects(ensureInvoiceForWorkOrder(sql, shop.id, c.workOrder.id, ACT), /cancelled/);
});

test("numbering: legacy proposal number kept stable; per-company sequence", async () => {
  const { sql } = await freshDb();
  const a = await seedShop(sql, "alpha");
  const b = await seedShop(sql, "beta");
  const a1 = await woFor(sql, a, "1 A St");
  const a2 = await woFor(sql, a, "2 A St");
  const b1 = await woFor(sql, b, "1 B St");
  const i1 = (await ensureInvoiceForWorkOrder(sql, a.id, a1.workOrder.id, ACT)).invoice;
  const i2 = (await ensureInvoiceForWorkOrder(sql, a.id, a2.workOrder.id, ACT)).invoice;
  const j1 = (await ensureInvoiceForWorkOrder(sql, b.id, b1.workOrder.id, ACT)).invoice;
  assert.deepEqual([i1.seq, i2.seq, j1.seq], [1, 2, 1]);
  assert.equal(invoiceSeqLabel(i2.seq), "INV-0002");
  // Same number the legacy proposal invoice/PDF/MX memo already showed.
  assert.equal(i1.number, paymentInvoiceNumber(a1.proposalId));
  assert.equal(j1.number, paymentInvoiceNumber(b1.proposalId));
});

test("draft editing; locked after send; due date validation", async () => {
  const { sql } = await freshDb();
  const shop = await seedShop(sql, "alpha");
  const s = await woFor(sql, shop, "1 Main St");
  const { invoice } = await ensureInvoiceForWorkOrder(sql, shop.id, s.workOrder.id, ACT);
  await assert.rejects(updateDraftInvoice(sql, shop.id, invoice.id, { dueDate: "2000-01-01" }, ACT), /before the issue/);
  await updateDraftInvoice(sql, shop.id, invoice.id, { dueDate: "2099-02-01", items: [{ name: "Gutters, all-in", qty: 1, unit_price: 1000 }] }, ACT);
  const b = await loadInvoiceForWorkOrder(sql, shop.id, s.workOrder.id);
  assert.equal(b.totals.total, 1000);
  assert.equal(b.invoice.due_date, "2099-02-01");
  // WO snapshot is untouched by invoice edits.
  assert.equal(await count(sql, "select count(*) c from work_order_items where work_order_id = $1", [s.workOrder.id]), 2);
  await markInvoiceSent(sql, shop.id, invoice.id, ACT);
  await assert.rejects(updateDraftInvoice(sql, shop.id, invoice.id, { notes: "x" }, ACT), /Only a draft/);
});

test("statuses: sent → partially paid → paid; amount due from payments; void rules", async () => {
  const { sql } = await freshDb();
  const shop = await seedShop(sql, "alpha");
  const { invoice } = await sentInvoice(sql, shop, "1 Main St");
  const total = 120 * 9.5 + 4 * 60;
  await assert.rejects(markInvoicePaid(sql, shop.id, invoice.id, ACT, { amount: total + 1 }), /more than the amount due/);
  await assert.rejects(markInvoicePaid(sql, shop.id, invoice.id, ACT, { method: "bitcoin" }), /method/);
  const part = await markInvoicePaid(sql, shop.id, invoice.id, ACT, { amount: 400, method: "check", paidOn: "2026-10-20" });
  assert.equal(part.invoice.status, "partially_paid");
  let b = await loadInvoice(sql, { kind: "shop", companyId: shop.id }, invoice.id);
  assert.equal(b.totals.amountDue, total - 400);
  await assert.rejects(voidInvoice(sql, shop.id, invoice.id, ACT), /Retract/);
  const full = await markInvoicePaid(sql, shop.id, invoice.id, ACT, { method: "ach" });
  assert.equal(full.payment.amount, total - 400);
  assert.equal(full.invoice.status, "paid");
  assert.ok(full.invoice.paid_at);
  b = await loadInvoice(sql, { kind: "shop", companyId: shop.id }, invoice.id);
  assert.equal(b.totals.amountDue, 0);
  await assert.rejects(markInvoicePaid(sql, shop.id, invoice.id, ACT), /already/);
  // Draft can't be marked paid; draft and sent can be voided.
  const s2 = await woFor(sql, shop, "2 Main St");
  const d = (await ensureInvoiceForWorkOrder(sql, shop.id, s2.workOrder.id, ACT)).invoice;
  await assert.rejects(markInvoicePaid(sql, shop.id, d.id, ACT), /Send the invoice/);
  assert.equal((await voidInvoice(sql, shop.id, d.id, ACT)).status, "void");
  await assert.rejects(markInvoicePaid(sql, shop.id, d.id, ACT), /void/);
});

test("5.7 paid marks: labelled, append-only, retract within 7 days by reversal row", async () => {
  const { sql } = await freshDb();
  const shop = await seedShop(sql, "alpha");
  const { invoice } = await sentInvoice(sql, shop, "1 Main St");
  const { payment } = await markInvoicePaid(sql, shop.id, invoice.id, ACT, { method: "cash", paidOn: "2026-10-21" });
  let b = await loadInvoice(sql, { kind: "shop", companyId: shop.id }, invoice.id);
  assert.equal(markedPaidLabel(shop.name, "2026-10-21"), "Marked paid by alpha Gutters on Oct 21, 2026");
  assert.match(b.history[0], /^Marked paid by alpha Gutters on Oct 21, 2026 \(entered by office@shop\.example\)/);
  assert.ok(!b.history.some((l) => /^Paid\b|receipt/i.test(l)));
  // DB refuses edits/deletes.
  await assert.rejects(sql`update invoice_payments set amount = 1 where id = ${payment.id}`, /append-only/);
  await assert.rejects(sql`delete from invoice_payments where id = ${payment.id}`, /append-only/);
  await assert.rejects(sql`update invoice_events set note = 'x' where invoice_id = ${invoice.id}`, /append-only/);
  await assert.rejects(sql`delete from invoice_events where invoice_id = ${invoice.id}`, /append-only/);
  // Retract after 7 days refused; within window appends a reversal.
  const late = new Date(Date.now() + 8 * 86400000);
  await assert.rejects(retractInvoicePayment(sql, shop.id, payment.id, ACT, null, late), /within 7 days/);
  const after = await retractInvoicePayment(sql, shop.id, payment.id, ACT, "Check bounced");
  assert.equal(after.status, "sent");
  await assert.rejects(retractInvoicePayment(sql, shop.id, payment.id, ACT), /already retracted/);
  b = await loadInvoice(sql, { kind: "shop", companyId: shop.id }, invoice.id);
  assert.equal(b.payments.length, 2);
  assert.equal(b.payments[1].reverses_id, payment.id);
  assert.match(b.history[1], /retracted by alpha Gutters/);
  assert.equal(b.totals.amountDue, b.totals.total);
  await addInvoiceNote(sql, shop.id, invoice.id, ACT, "Customer will pay Friday");
  b = await loadInvoice(sql, { kind: "shop", companyId: shop.id }, invoice.id);
  assert.deepEqual(
    b.events.map((e) => e.kind),
    ["created", "status", "payment", "status", "reversal", "status", "note"],
  );
  assert.ok(b.events.every((e) => e.actor_label && e.company_id === shop.id));
});

test("5.4 paid is status only: no jobs / job_specs / filing writes", async () => {
  const { sql } = await freshDb();
  const shop = await seedShop(sql, "alpha");
  const { invoice } = await sentInvoice(sql, shop, "1 Main St");
  const jobs = await count(sql, "select count(*) c from jobs", []);
  await markInvoicePaid(sql, shop.id, invoice.id, ACT);
  assert.equal(await count(sql, "select count(*) c from jobs", []), jobs);
  const src = (await readFile(join(root, "src/lib/housefile/invoices.ts"), "utf8"))
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(src, /(insert\s+into|update|delete\s+from)\s+(jobs|job_specs|property_warranties)\b|writeAccepted|writeJobOnFile/i);
});

test("tenancy + 5.7 visibility: shop, homeowner, entitled PM yes; other shop / stranger / unpaid PM no", async () => {
  const { sql } = await freshDb();
  const a = await seedShop(sql, "alpha");
  const b = await seedShop(sql, "beta");
  const s = await sentInvoice(sql, a, "9 Shared Ln");
  await markInvoicePaid(sql, a.id, s.invoice.id, ACT, { amount: 100 });
  // Shop B has its own record at the SAME address (copied row): still nothing.
  await seedSold(sql, b.id, "9 Shared Ln");
  await sql`update properties set homeowner_user_id = ${"ho_1"} where id = ${s.propertyId}`;
  // Entitled PM (paid portfolio member) holds a row at the same address.
  const pmProp = `prop_pm_${(n += 1)}`;
  await sql`insert into properties (id, company_id, share_token, invite_token, address_line, city, state, zip, homeowner_name, homeowner_email, homeowner_phone) values (${pmProp}, ${b.id}, ${`t_${pmProp}`}, ${`i_${pmProp}`}, ${"9 shared ln "}, ${"Austin"}, ${"TX"}, ${"78701"}, ${"Owner"}, ${"o@pm.example"}, ${"512-555-0100"})`;
  await sql`insert into portfolios (id, user_id, name, paid_at) values ('pf1', 'pm_owner', 'PM Co', now()), ('pf2', 'pm_unpaid', 'Free PM', null)`;
  await sql`insert into portfolio_members (id, portfolio_id, user_id, email) values ('m1', 'pf1', 'pm_staff', 'staff@pm.example')`;
  await sql`insert into portfolio_properties (portfolio_id, property_id) values ('pf1', ${pmProp}), ('pf2', ${pmProp})`;
  // Explicit link (as written on accept / 0031): the job copy for this proposal on the PM row.
  await sql`insert into jobs (id, company_id, property_id, proposal_id, title, summary, completed_at) values (${`job_${pmProp}`}, ${a.id}, ${pmProp}, ${s.invoice.proposal_id}, 'Job', 'Job', current_date)`;

  for (const viewer of [
    { kind: "shop", companyId: a.id },
    { kind: "homeowner", userId: "ho_1" },
    { kind: "pm", userId: "pm_owner" },
    { kind: "pm", userId: "pm_staff" },
  ]) {
    const v = await loadInvoice(sql, viewer, s.invoice.id);
    assert.equal(v.totals.paid, 100, viewer.kind);
    assert.equal(v.events.length > 0, viewer.kind === "shop", "only the shop sees internal events");
  }
  for (const viewer of [
    { kind: "shop", companyId: b.id },
    { kind: "homeowner", userId: "ho_other" },
    { kind: "pm", userId: "pm_unpaid" },
    { kind: "pm", userId: "stranger" },
  ]) {
    await assert.rejects(loadInvoice(sql, viewer, s.invoice.id), /not found/, JSON.stringify(viewer));
  }
  // Lists: HO and PM see it on their own row; others see an empty list (no count).
  assert.equal((await listInvoicesForProperty(sql, { kind: "homeowner", userId: "ho_1" }, s.propertyId)).length, 1);
  assert.equal((await listInvoicesForProperty(sql, { kind: "pm", userId: "pm_staff" }, pmProp)).length, 1);
  assert.equal((await listInvoicesForProperty(sql, { kind: "pm", userId: "pm_unpaid" }, pmProp)).length, 0);
  assert.equal((await listInvoicesForProperty(sql, { kind: "homeowner", userId: "ho_other" }, s.propertyId)).length, 0);
  // Shop B cannot touch shop A's invoice through any write path.
  await assert.rejects(markInvoicePaid(sql, b.id, s.invoice.id, ACT), /not found/);
  await assert.rejects(voidInvoice(sql, b.id, s.invoice.id, ACT), /not found/);
  await assert.rejects(updateDraftInvoice(sql, b.id, s.invoice.id, {}, ACT), /not found/);
  await assert.rejects(addInvoiceNote(sql, b.id, s.invoice.id, ACT, "x"), /not found/);
  await assert.rejects(ensureInvoiceForWorkOrder(sql, b.id, s.workOrder.id, ACT), /not found/);
  assert.equal(await loadInvoiceForWorkOrder(sql, b.id, s.workOrder.id), null);
  // Drafts stay shop-only.
  const d = await woFor(sql, a, "9 Shared Ln");
  const draft = (await ensureInvoiceForWorkOrder(sql, a.id, d.workOrder.id, ACT)).invoice;
  await assert.rejects(loadInvoice(sql, { kind: "homeowner", userId: "ho_1" }, draft.id), /not found/);
});

test("no address matching: unentitled same-address rows see nothing", async () => {
  const { sql } = await freshDb();
  const a = await seedShop(sql, "alpha");
  const b = await seedShop(sql, "beta");
  const s = await sentInvoice(sql, a, "4 Elm St");
  // A household row at the SAME street + zip, claimed by another user, with no job copy.
  const other = `prop_other_${(n += 1)}`;
  await sql`insert into properties (id, company_id, share_token, invite_token, address_line, city, state, zip, homeowner_name, homeowner_email, homeowner_phone, homeowner_user_id) values (${other}, ${b.id}, ${`t_${other}`}, ${`i_${other}`}, ${"4 elm st"}, ${"Austin"}, ${"TX"}, ${"78701"}, ${"N"}, ${"n@x.example"}, ${"512-555-0101"}, ${"ho_neighbor"})`;
  // A paid PM portfolio holding that same-address row, also with no job copy.
  await sql`insert into portfolios (id, user_id, name, paid_at) values ('pfx', 'pm_x', 'PM X', now())`;
  await sql`insert into portfolio_properties (portfolio_id, property_id) values ('pfx', ${other})`;
  for (const viewer of [{ kind: "homeowner", userId: "ho_neighbor" }, { kind: "pm", userId: "pm_x" }]) {
    await assert.rejects(loadInvoice(sql, viewer, s.invoice.id), /not found/, viewer.kind);
    assert.equal((await listInvoicesForProperty(sql, viewer, other)).length, 0, viewer.kind);
  }
  // Not entitled to the row they ask about: empty, even for the real row.
  assert.equal((await listInvoicesForProperty(sql, { kind: "homeowner", userId: "ho_neighbor" }, s.propertyId)).length, 0);
});

test("no fee: Pay link prefills the plain amount due; only the issuing shop's link", () => {
  const url = invoicePayUrl({
    proposalPaymentLink: null,
    shopPaymentLink: "https://alpha.mxmerchant.com/checkout",
    invoiceNumber: "12345678",
    amountDue: 980.5,
    propertyId: "prop_x",
  });
  assert.equal(new URL(url).searchParams.get("amt"), "980.50");
  const own = invoicePayUrl({ proposalPaymentLink: "pay.alpha.example/x", shopPaymentLink: "https://other.example", invoiceNumber: "1", amountDue: 10, propertyId: "p" });
  assert.equal(own, "https://pay.alpha.example/x");
  assert.equal(invoicePayUrl({ proposalPaymentLink: null, shopPaymentLink: null, invoiceNumber: "1", amountDue: 10, propertyId: "p" }), null);
  assert.equal(invoicePayUrl({ proposalPaymentLink: null, shopPaymentLink: "https://a.example", invoiceNumber: "1", amountDue: 0, propertyId: "p" }), null);
});

test("Counsel line on invoice view/PDF copy and invoice email text", () => {
  const line = invoiceNoProcessingLine("Alpha Gutters");
  assert.equal(
    line,
    "Payments go directly to Alpha Gutters. PlanitService does not process, hold, or refund payments. Contact Alpha Gutters with payment questions.",
  );
  for (const hasPortal of [true, false]) {
    assert.ok(invoicePaymentCopy({ companyName: "Alpha Gutters", paymentTerms: null, invoiceNo: "1", hasPortal }).includes(line));
  }
  for (const payUrl of ["https://pay.example", null]) {
    const text = renderInvoiceText({ shopName: "Alpha Gutters", seq: 3, number: "12345678", dueDate: "2026-11-01", amountDue: 50, payUrl, propertyAddress: "1 Main St" });
    assert.ok(text.includes(line));
    assert.doesNotMatch(text, /fee/i);
    assert.match(text, /INV-0003/);
  }
});

test("status label is viewer-aware: shop Paid; homeowner and PM Marked paid", async () => {
  assert.equal(invoiceStatusLabel("paid", "shop"), "Paid");
  assert.equal(invoiceStatusLabel("partially_paid", "shop"), "Partially paid");
  assert.equal(invoiceStatusLabel("paid"), "Paid", "default is the shop's own view");
  assert.equal(invoiceStatusLabel("paid", "homeowner"), "Marked paid");
  assert.equal(invoiceStatusLabel("partially_paid", "homeowner"), "Partially marked paid");
  assert.equal(invoiceStatusLabel("paid", "pm"), "Marked paid");
  assert.equal(invoiceStatusLabel("partially_paid", "pm"), "Partially marked paid");
  for (const v of ["shop", "homeowner", "pm"]) {
    assert.equal(invoiceStatusLabel("sent", v), "Sent");
    assert.equal(invoiceStatusLabel("void", v), "Void");
  }
  const panel = await readFile(join(root, "src/components/invoice-panel.tsx"), "utf8");
  const home = await readFile(join(root, "src/routes/home/$id.tsx"), "utf8");
  const manage = await readFile(join(root, "src/routes/manage/$id.tsx"), "utf8");
  assert.match(panel, /<InvoiceBadge status=\{r\.status\} viewer=\{viewer\} \/>/);
  assert.match(panel, /<InvoiceBadge status=\{inv\.status\} \/>/, "shop panel keeps shop wording");
  assert.match(home, /<PropertyInvoices propertyId=\{p\.id\} viewer="homeowner" \/>/);
  assert.match(manage, /<PropertyInvoices propertyId=\{p\.id\} viewer="pm" \/>/);
});

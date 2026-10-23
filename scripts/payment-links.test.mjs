// Sprint 1 #6: contractor payment links. 6.1 ruling: two slots (payment_link,
// paint_payment_link) and ONE Pay button per invoice.
// PGLite with every migration. PlanitService processes nothing; no fee.
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import "./ts-resolve.mjs";
const { ensureWorkOrder } = await import("../src/lib/housefile/work-orders.ts");
const {
  ensureInvoiceForWorkOrder,
  invoiceNoProcessingLine,
  invoicePayButton,
  loadInvoice,
  listInvoicesForProperty,
  markInvoicePaid,
  markInvoiceSent,
  renderInvoiceText,
} = await import("../src/lib/housefile/invoices.ts");
const {
  acceptPaymentLink,
  isHttpsPaymentLink,
  normalizePaymentLink,
  resolveInvoicePaymentLink,
  shopPaymentLinkForWork,
} = await import("../src/lib/housefile/payment.ts");

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

async function seedShop(sql, name, links = {}) {
  const id = `co_${name}_${(n += 1)}`;
  await sql`insert into companies (id, user_id, name, slug, email) values (${id}, ${`user_${id}`}, ${`${name} Gutters`}, ${id}, ${`office@${id}.example`})`;
  return { id, name: `${name} Gutters` };
}

async function seedSold(sql, companyId, address, status = "accepted", templateId = null, proposalLink = null) {
  const propertyId = `prop_${(n += 1)}`;
  await sql`
    insert into properties (id, company_id, share_token, invite_token, address_line, city, state, zip, homeowner_name, homeowner_email, homeowner_phone)
    values (${propertyId}, ${companyId}, ${`tok_${propertyId}`}, ${`inv_${propertyId}`}, ${address}, ${"Austin"}, ${"TX"}, ${"78701"}, ${HO.name}, ${HO.email}, ${HO.phone})
  `;
  const proposalId = `pr_${(n += 1)}`;
  await sql`
    insert into proposals (id, company_id, property_id, share_token, title, status, accepted_at, scheduled_on, template_id, payment_link)
    values (${proposalId}, ${companyId}, ${propertyId}, ${`share_${proposalId}`}, ${"Gutters"}, ${status},
      ${status === "draft" ? null : new Date().toISOString()}, ${status === "draft" ? null : "2026-11-01"}, ${templateId}, ${proposalLink})
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

async function woFor(sql, shop, address, status = "accepted", templateId = null, proposalLink = null) {
  const s = await seedSold(sql, shop.id, address, status, templateId, proposalLink);
  const { workOrder } = await ensureWorkOrder(sql, s.proposalId, "test");
  return { ...s, workOrder };
}

async function sentInvoice(sql, shop, address, templateId = null, proposalLink = null) {
  const s = await woFor(sql, shop, address, "accepted", templateId, proposalLink);
  const { invoice } = await ensureInvoiceForWorkOrder(sql, shop.id, s.workOrder.id, ACT, { dueDate: "2099-01-01" });
  await markInvoiceSent(sql, shop.id, invoice.id, ACT);
  return { ...s, invoice };
}


const MX_A_GUTTER = "https://alpha.mxmerchant.com/checkout/gutters";
const MX_A_PAINT = "https://alpha.mxmerchant.com/checkout/paint";
const MX_B_GUTTER = "https://beta.mxmerchant.com/checkout/gutters";
const MX_B_PAINT = "https://beta.mxmerchant.com/checkout/paint";

async function setLinks(sql, id, { gutters = null, paint = null }) {
  await sql`update companies set payment_link = ${gutters}, paint_payment_link = ${paint} where id = ${id}`;
}

const strip = (code) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("6.3 validation: new links https only; javascript:/data: never; https byte-identical", () => {
  for (const ok of [MX_A_GUTTER, "https://pay.example.com/x?a=1&b=2", "https://Pay.Example.com/Path"]) {
    assert.equal(normalizePaymentLink(ok), ok);
    assert.equal(acceptPaymentLink(ok, []), ok);
  }
  assert.equal(acceptPaymentLink("pay.example.com/x", []), "https://pay.example.com/x", "bare host gets https://");
  for (const bad of ["javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,<b>x</b>", "mailto:a@b.c", "ftp://x.example", "https://", "not a url"]) {
    assert.equal(normalizePaymentLink(bad), null, `never renders: ${bad}`);
    assert.throws(() => acceptPaymentLink(bad, []), /https/, bad);
  }
  assert.equal(isHttpsPaymentLink("http://pay.example.com"), false);
  assert.equal(acceptPaymentLink("", ["http://old.example"]), null, "blank clears");
  assert.equal(acceptPaymentLink(null, []), null);
});

test("grandfathered: a stored http link still renders a Pay button, unchanged", async () => {
  const { sql } = await freshDb();
  const a = await seedShop(sql, "alpha");
  const OLD = "http://pay.alpha.example/legacy";
  await setLinks(sql, a.id, { gutters: OLD, paint: "http://paint.alpha.example" });
  const g = await sentInvoice(sql, a, "1 Main St", "tmpl_gutter");
  const bg = await loadInvoice(sql, { kind: "shop", companyId: a.id }, g.invoice.id);
  assert.equal(bg.payButton.href, OLD, "byte-identical, not upgraded to https");
  const p = await sentInvoice(sql, a, "2 Main St", "tmpl_ext_paint");
  assert.equal((await loadInvoice(sql, { kind: "shop", companyId: a.id }, p.invoice.id)).payButton.href, "http://paint.alpha.example");
  // A stored http proposal link (per-estimate override) also renders.
  const o = await sentInvoice(sql, a, "3 Main St", "tmpl_gutter", "http://override.alpha.example/x");
  assert.equal((await loadInvoice(sql, { kind: "shop", companyId: a.id }, o.invoice.id)).payButton.href, "http://override.alpha.example/x");
  // Nothing rewrote the stored values.
  const [row] = await sql`select payment_link, paint_payment_link from companies where id = ${a.id}`;
  assert.deepEqual(row, { payment_link: OLD, paint_payment_link: "http://paint.alpha.example" });
  // No migration in this change touches payment link columns (no DB check rejects old http rows).
  const dir = join(root, "migrations");
  for (const f of await readdir(dir)) {
    if (f >= "0063") assert.doesNotMatch(await readFile(join(dir, f), "utf8"), /payment_link/i, f);
  }
});

test("stored non-http links (javascript:, data:, mailto:) render no Pay button", async () => {
  const { sql } = await freshDb();
  const a = await seedShop(sql, "alpha");
  for (const bad of ["javascript:alert(1)", "data:text/html,<b>x</b>", "mailto:pay@alpha.example"]) {
    await setLinks(sql, a.id, { gutters: bad, paint: bad });
    for (const tmpl of ["tmpl_gutter", "tmpl_ext_paint"]) {
      const s = await sentInvoice(sql, a, `${bad} ${tmpl}`, tmpl);
      assert.equal((await loadInvoice(sql, { kind: "shop", companyId: a.id }, s.invoice.id)).payButton, null, `${tmpl}: ${bad}`);
      await sql`update properties set homeowner_user_id = 'ho_x' where id = ${s.propertyId}`;
      const list = await listInvoicesForProperty(sql, { kind: "homeowner", userId: "ho_x" }, s.propertyId);
      assert.equal(list[0].payButton, null, `homeowner list: ${bad}`);
    }
    const o = await sentInvoice(sql, a, `${bad} override`, "tmpl_gutter", bad);
    assert.equal((await loadInvoice(sql, { kind: "shop", companyId: a.id }, o.invoice.id)).payButton, null, `proposal link: ${bad}`);
  }
});

test("save: a NEW http link is rejected; an unchanged http link re-saved is accepted as stored", async () => {
  const OLD = "http://pay.alpha.example/legacy";
  // Exactly what updateCompany does for slot 1 / slot 2.
  assert.throws(() => acceptPaymentLink("http://new.alpha.example", [OLD], "Payment link 1"), /Payment link 1 must be a valid https/);
  assert.throws(() => acceptPaymentLink("http://pay.alpha.example/legacy2", [OLD]), /https/, "edited = new");
  assert.equal(acceptPaymentLink(OLD, [OLD]), OLD, "unchanged re-save is not an edit");
  assert.equal(acceptPaymentLink(`  ${OLD} `, [OLD]), OLD, "whitespace from the form is not an edit; stored value kept");
  assert.equal(acceptPaymentLink("https://new.alpha.example", [OLD]), "https://new.alpha.example");
  // The settings form posts both fields back unchanged; the server compares each to its own stored column.
  const server = strip(await readFile(join(root, "src/lib/housefile/server.ts"), "utf8"));
  assert.match(server, /acceptPaymentLink\(data\.payment_link, \[company\.payment_link\]/);
  assert.match(server, /acceptPaymentLink\(data\.paint_payment_link, \[company\.paint_payment_link\]/);
  assert.doesNotMatch(server, /normalizePaymentLink\(data\./, "no save path bypasses the https rule");
  // Validation happens before the update (throws first, no partial write).
  const fn = server.slice(server.indexOf("export const updateCompany"));
  assert.ok(fn.indexOf("acceptPaymentLink(data.payment_link") < fn.indexOf("update companies"));
  // Client hint: warns only on a non-https value that differs from what is saved.
  const ui = await readFile(join(root, "src/routes/app/settings.tsx"), "utf8");
  assert.match(ui, /raw === \(saved \?\? ""\)\.trim\(\) \|\| isHttpsPaymentLink\(raw\)/);
  assert.match(ui, /<PayLinkHint value=\{paymentLink\} saved=\{q\.data\?\.company\.payment_link\} \/>/);
  assert.match(ui, /<PayLinkHint value=\{paintPaymentLink\} saved=\{q\.data\?\.company\.paint_payment_link\} \/>/);
});

test("6.1 ruling: two slots, generic copy, no extra label+URL links", async () => {
  const ui = await readFile(join(root, "src/routes/app/settings.tsx"), "utf8");
  assert.match(ui, /Payment link 1</);
  assert.match(ui, /Payment link 2</);
  assert.doesNotMatch(ui, /payLinks|payment_links|Add payment link|painting-plus/i);
  const types = await readFile(join(root, "src/lib/housefile/types.ts"), "utf8");
  assert.doesNotMatch(types, /payment_links/);
  const { sql } = await freshDb();
  const cols = await sql`select column_name from information_schema.columns where table_name = 'companies' and column_name like '%payment_link%' order by 1`;
  assert.deepEqual(cols.map((c) => c.column_name), ["paint_payment_link", "payment_link"]);
});

test("6.2 regression: gutters and paint routing produce byte-identical URLs", () => {
  const shop = { payment_link: MX_A_GUTTER, paint_payment_link: MX_A_PAINT };
  assert.equal(shopPaymentLinkForWork("gutters", shop), MX_A_GUTTER);
  assert.equal(shopPaymentLinkForWork("paint", shop), MX_A_PAINT);
  assert.equal(shopPaymentLinkForWork("roof", shop), MX_A_PAINT);
  assert.equal(shopPaymentLinkForWork("paint", { payment_link: MX_A_GUTTER }), MX_A_GUTTER);
  assert.equal(resolveInvoicePaymentLink({ proposalPaymentLink: null, workId: "gutters", shop }), MX_A_GUTTER);
  assert.equal(resolveInvoicePaymentLink({ proposalPaymentLink: null, workId: "paint", shop }), MX_A_PAINT);
  assert.equal(resolveInvoicePaymentLink({ proposalPaymentLink: "https://override.example/p", workId: "paint", shop }), "https://override.example/p");
  assert.equal(resolveInvoicePaymentLink({ proposalPaymentLink: null, workId: "paint", shop: {} }), null);
});

test("one button renders: 'Pay {Shop} online' + direct-to-shop disclaimer, in view, list and email", async () => {
  const { sql } = await freshDb();
  const a = await seedShop(sql, "alpha");
  await setLinks(sql, a.id, { gutters: MX_A_GUTTER, paint: MX_A_PAINT });
  const s = await sentInvoice(sql, a, "1 Main St", "tmpl_gutter");
  const b = await loadInvoice(sql, { kind: "shop", companyId: a.id }, s.invoice.id);
  assert.equal(b.payButton.label, "Pay alpha Gutters online");
  assert.equal(b.payButton.disclaimer, invoiceNoProcessingLine("alpha Gutters"));
  assert.match(b.payButton.disclaimer, /^Payments go directly to alpha Gutters\. PlanitService does not process/);
  assert.ok(b.payButton.href.startsWith(MX_A_GUTTER));
  assert.equal(Object.hasOwn(b, "payButtons"), false, "single button, not a list");
  const text = renderInvoiceText({ shopName: "alpha Gutters", seq: 1, number: "1", dueDate: null, amountDue: 1, payUrl: b.payButton.href, propertyAddress: "1 Main St" });
  assert.equal(text.match(/Pay alpha Gutters online:/g).length, 1);
  assert.ok(text.includes(invoiceNoProcessingLine("alpha Gutters")));
  await sql`update properties set homeowner_user_id = 'ho_1' where id = ${s.propertyId}`;
  const list = await listInvoicesForProperty(sql, { kind: "homeowner", userId: "ho_1" }, s.propertyId);
  assert.deepEqual(list[0].payButton, b.payButton);
  const ui = await readFile(join(root, "src/components/invoice-panel.tsx"), "utf8");
  assert.match(ui, /export function PayButtonRow/);
  assert.match(ui, /\{button\.label\}/);
  assert.match(ui, /\{button\.disclaimer\}/);
  assert.match(ui, /for payment terms/);
  assert.doesNotMatch(ui, /\.map\(\(b\) =>/, "no list of buttons");
  const server = strip(await readFile(join(root, "src/lib/housefile/server.ts"), "utf8"));
  assert.match(server, /const payUrl = bundle\.payButton\?\.href \?\? null;/, "email uses the same button");
});

test("6.4 no button when nothing resolves, nothing is due, draft, paid or void (terms text instead)", async () => {
  const { sql } = await freshDb();
  const a = await seedShop(sql, "alpha");
  const s = await sentInvoice(sql, a, "1 Main St", "tmpl_gutter");
  assert.equal((await loadInvoice(sql, { kind: "shop", companyId: a.id }, s.invoice.id)).payButton, null);
  const text = renderInvoiceText({ shopName: "alpha Gutters", seq: 1, number: "1", dueDate: null, amountDue: 5, payUrl: null, propertyAddress: "x" });
  assert.match(text, /Contact alpha Gutters for payment terms/);
  const base = { shopName: "S", amountDue: 10, invoiceNumber: "1", propertyId: "p", routedLink: "https://pay.s.example" };
  for (const status of ["draft", "void", "paid"]) assert.equal(invoicePayButton({ ...base, status }), null, status);
  assert.equal(invoicePayButton({ ...base, status: "sent", amountDue: 0 }), null);
  assert.equal(invoicePayButton({ ...base, status: "sent", routedLink: "javascript:alert(1)" }), null);
  assert.ok(invoicePayButton({ ...base, status: "partially_paid" }));
});

test("6.9 no fee: prefill equals the plain amount due for a gutters and a paint invoice", async () => {
  const { sql } = await freshDb();
  const a = await seedShop(sql, "alpha");
  await setLinks(sql, a.id, { gutters: MX_A_GUTTER, paint: MX_A_PAINT });
  for (const [tmpl, base] of [["tmpl_gutter", MX_A_GUTTER], ["tmpl_ext_paint", MX_A_PAINT]]) {
    const s = await sentInvoice(sql, a, `${tmpl} St`, tmpl);
    let b = await loadInvoice(sql, { kind: "shop", companyId: a.id }, s.invoice.id);
    assert.equal(b.totals.total, 1380);
    assert.ok(b.payButton.href.startsWith(`${base}?`), tmpl);
    assert.equal(new URL(b.payButton.href).searchParams.get("amt"), "1380.00", tmpl);
    await markInvoicePaid(sql, a.id, s.invoice.id, ACT, { amount: 380.25 });
    b = await loadInvoice(sql, { kind: "shop", companyId: a.id }, s.invoice.id);
    assert.equal(new URL(b.payButton.href).searchParams.get("amt"), "999.75", "after a partial: plain remaining due");
  }
  for (const f of ["src/lib/housefile/payment.ts", "src/lib/housefile/invoices.ts", "src/components/invoice-panel.tsx", "src/routes/app/settings.tsx"]) {
    assert.doesNotMatch(strip(await readFile(join(root, f), "utf8")), /CARD_FEE|withCardFee|surcharge|card fee|\b0\.03\b|3%/i, f);
  }
});

test("on Paid: status only, no Property Record writeback; opening a link changes nothing", async () => {
  const { sql } = await freshDb();
  const a = await seedShop(sql, "alpha");
  await setLinks(sql, a.id, { gutters: MX_A_GUTTER });
  const s = await sentInvoice(sql, a, "1 Main St", "tmpl_gutter");
  const tables = ["jobs", "job_specs", "property_warranties", "properties"];
  const before = {};
  for (const t of tables) before[t] = await count(sql, `select count(*) c from ${t}`, []);
  const b1 = await loadInvoice(sql, { kind: "shop", companyId: a.id }, s.invoice.id);
  assert.equal(b1.invoice.status, "sent", "building the button does not change status");
  await markInvoicePaid(sql, a.id, s.invoice.id, ACT);
  const b2 = await loadInvoice(sql, { kind: "shop", companyId: a.id }, s.invoice.id);
  assert.equal(b2.invoice.status, "paid");
  assert.equal(b2.payButton, null, "no Pay button once paid");
  for (const t of tables) assert.equal(await count(sql, `select count(*) c from ${t}`, []), before[t], t);
});

test("6.5/6.8 tenancy: A's invoices resolve only to A's links across work types; never B's", async () => {
  const { sql } = await freshDb();
  const a = await seedShop(sql, "alpha");
  const b = await seedShop(sql, "beta");
  const c = await seedShop(sql, "gamma"); // no links at all
  await setLinks(sql, a.id, { gutters: MX_A_GUTTER, paint: MX_A_PAINT });
  await setLinks(sql, b.id, { gutters: MX_B_GUTTER, paint: MX_B_PAINT });
  for (const tmpl of ["tmpl_gutter", "tmpl_ext_paint", "tmpl_int_paint", "tmpl_roof", "tmpl_deck", null]) {
    const sa = await sentInvoice(sql, a, `7 Shared ${tmpl}`, tmpl);
    const sb = await sentInvoice(sql, b, `7 Shared ${tmpl}`, tmpl);
    const ba = await loadInvoice(sql, { kind: "shop", companyId: a.id }, sa.invoice.id);
    assert.ok(ba.payButton.href.includes("alpha"), `${tmpl}: ${ba.payButton.href}`);
    assert.ok(![MX_B_GUTTER, MX_B_PAINT].some((u) => ba.payButton.href.startsWith(u)), String(tmpl));
    assert.match(ba.payButton.label, /alpha/);
    const bb = await loadInvoice(sql, { kind: "shop", companyId: b.id }, sb.invoice.id);
    assert.ok(bb.payButton.href.includes("beta"), `${tmpl}: ${bb.payButton.href}`);
    await assert.rejects(loadInvoice(sql, { kind: "shop", companyId: b.id }, sa.invoice.id), /not found/);
  }
  const sc = await sentInvoice(sql, c, "9 Shared Ln", "tmpl_gutter");
  assert.equal((await loadInvoice(sql, { kind: "shop", companyId: c.id }, sc.invoice.id)).payButton, null);
  const so = await sentInvoice(sql, a, "11 Override Rd", "tmpl_ext_paint", "https://override.alpha.example/p");
  assert.equal((await loadInvoice(sql, { kind: "shop", companyId: a.id }, so.invoice.id)).payButton.href, "https://override.alpha.example/p");
  const code = strip(await readFile(join(root, "src/lib/housefile/payment.ts"), "utf8"));
  assert.doesNotMatch(code, /https?:\/\/[a-z0-9.-]+\.[a-z]{2,}/i);
  assert.doesNotMatch(code, /painting.?plus/i);
});

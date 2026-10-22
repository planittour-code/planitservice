// Sprint 1 #6: contractor payment links (generic, alongside gutters/paint).
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
  invoicePayButtons,
  loadInvoice,
  listInvoicesForProperty,
  markInvoicePaid,
  markInvoiceSent,
  renderInvoiceText,
} = await import("../src/lib/housefile/invoices.ts");
const {
  MAX_PAYMENT_LINKS,
  normalizePaymentLink,
  normalizePaymentLinks,
  resolveInvoicePaymentLink,
  shopPaymentLinkForWork,
  storedPaymentLinks,
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

async function setLinks(sql, id, { gutters = null, paint = null, generic = [] }) {
  await sql`update companies set payment_link = ${gutters}, paint_payment_link = ${paint}, payment_links = ${JSON.stringify(generic)}::jsonb where id = ${id}`;
}

test("6.3 validation: https only; javascript:/data:/http rejected; existing https byte-identical", () => {
  for (const ok of [MX_A_GUTTER, "https://pay.example.com/x?a=1&b=2", "https://Pay.Example.com/Path"]) {
    assert.equal(normalizePaymentLink(ok), ok);
  }
  assert.equal(normalizePaymentLink("pay.example.com/x"), "https://pay.example.com/x");
  for (const bad of ["javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,<b>x</b>", "http://pay.example.com", "mailto:a@b.c", "ftp://x.example", "https://", "not a url", "localhost"]) {
    assert.equal(normalizePaymentLink(bad), null, bad);
  }
  assert.equal(normalizePaymentLink(""), null);
  assert.equal(normalizePaymentLink(null), null);
});

test("max 2 generic links: validator, stored reader and DB constraint", async () => {
  assert.equal(MAX_PAYMENT_LINKS, 2);
  const two = [{ label: "Card", url: "https://pay.example/a" }, { label: "ACH", url: "pay.example/b" }];
  assert.deepEqual(normalizePaymentLinks(two), [two[0], { label: "ACH", url: "https://pay.example/b" }]);
  assert.deepEqual(normalizePaymentLinks([{ label: "", url: "" }, ...two]), normalizePaymentLinks(two), "blank rows dropped");
  assert.throws(() => normalizePaymentLinks([...two, { label: "Third", url: "https://pay.example/c" }]), /Up to 2/);
  assert.throws(() => normalizePaymentLinks([{ label: "", url: "https://pay.example/a" }]), /label/);
  assert.throws(() => normalizePaymentLinks([{ label: "X", url: "javascript:alert(1)" }]), /https/);
  assert.throws(() => normalizePaymentLinks([{ label: "X", url: "data:text/html,hi" }]), /https/);
  assert.throws(() => normalizePaymentLinks("nope"), /list/);
  assert.deepEqual(storedPaymentLinks([{ label: "X", url: "javascript:1" }, ...two, { label: "Z", url: "https://z.example" }]).length, 2);

  const { sql } = await freshDb();
  const shop = await seedShop(sql, "alpha");
  await setLinks(sql, shop.id, { generic: two });
  await assert.rejects(
    sql`update companies set payment_links = ${JSON.stringify([...two, { label: "c", url: "https://c.example" }])}::jsonb where id = ${shop.id}`,
    /payment_links_max2/,
  );
  // Existing gutters/paint columns untouched.
  await setLinks(sql, shop.id, { gutters: MX_A_GUTTER, paint: MX_A_PAINT, generic: two });
  const [row] = await sql`select payment_link, paint_payment_link from companies where id = ${shop.id}`;
  assert.deepEqual(row, { payment_link: MX_A_GUTTER, paint_payment_link: MX_A_PAINT });
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

test("buttons render: 'Pay {Shop} online', direct-to-shop disclaimer, routed + up to 2 generic, deduped", async () => {
  const { sql } = await freshDb();
  const a = await seedShop(sql, "alpha");
  await setLinks(sql, a.id, {
    gutters: MX_A_GUTTER,
    paint: MX_A_PAINT,
    generic: [{ label: "Card or ACH", url: "https://pay.alpha.example/card" }, { label: "Dup", url: MX_A_GUTTER }],
  });
  const s = await sentInvoice(sql, a, "1 Main St", "tmpl_gutter");
  const b = await loadInvoice(sql, { kind: "shop", companyId: a.id }, s.invoice.id);
  assert.equal(b.payButtons.length, 2, "routed + 1 generic; duplicate URL dropped");
  for (const btn of b.payButtons) {
    assert.equal(btn.label, "Pay alpha Gutters online");
    assert.equal(btn.disclaimer, invoiceNoProcessingLine("alpha Gutters"));
    assert.match(btn.disclaimer, /^Payments go directly to alpha Gutters\. PlanitService does not process/);
  }
  assert.equal(b.payButtons[0].via, null);
  assert.ok(b.payButtons[0].href.startsWith(MX_A_GUTTER));
  assert.deepEqual([b.payButtons[1].via, b.payButtons[1].href], ["Card or ACH", "https://pay.alpha.example/card"]);
  // Email text carries every button + the Counsel line.
  const text = renderInvoiceText({ shopName: "alpha Gutters", seq: 1, number: "1", dueDate: null, amountDue: 1, payUrl: null, propertyAddress: "1 Main St", payButtons: b.payButtons });
  assert.match(text, /Pay alpha Gutters online: https:\/\/alpha\.mxmerchant\.com/);
  assert.match(text, /Pay alpha Gutters online \(Card or ACH\): https:\/\/pay\.alpha\.example\/card/);
  assert.ok(text.includes(invoiceNoProcessingLine("alpha Gutters")));
  // Homeowner sees the same buttons on the read-only list.
  await sql`update properties set homeowner_user_id = 'ho_1' where id = ${s.propertyId}`;
  const list = await listInvoicesForProperty(sql, { kind: "homeowner", userId: "ho_1" }, s.propertyId);
  assert.deepEqual(list[0].payButtons, b.payButtons);
  // UI component renders label, via and disclaimer from the bundle.
  const ui = await readFile(join(root, "src/components/invoice-panel.tsx"), "utf8");
  assert.match(ui, /export function PayButtons/);
  assert.match(ui, /\{b\.label\}/);
  assert.match(ui, /disclaimer/);
  assert.match(ui, /for payment terms/);
});

test("6.4 no buttons when nothing resolves, nothing is due, draft or void (terms text instead)", async () => {
  const { sql } = await freshDb();
  const a = await seedShop(sql, "alpha");
  const s = await sentInvoice(sql, a, "1 Main St", "tmpl_gutter");
  assert.deepEqual((await loadInvoice(sql, { kind: "shop", companyId: a.id }, s.invoice.id)).payButtons, []);
  const text = renderInvoiceText({ shopName: "alpha Gutters", seq: 1, number: "1", dueDate: null, amountDue: 5, payUrl: null, propertyAddress: "x", payButtons: [] });
  assert.match(text, /Contact alpha Gutters for payment terms/);
  const base = { shopName: "S", amountDue: 10, invoiceNumber: "1", propertyId: "p", routedLink: "https://pay.s.example", genericLinks: [] };
  assert.equal(invoicePayButtons({ ...base, status: "draft" }).length, 0);
  assert.equal(invoicePayButtons({ ...base, status: "void" }).length, 0);
  assert.equal(invoicePayButtons({ ...base, status: "paid" }).length, 0);
  assert.equal(invoicePayButtons({ ...base, status: "sent", amountDue: 0 }).length, 0);
  assert.equal(invoicePayButtons({ ...base, status: "partially_paid" }).length, 1);
  assert.equal(invoicePayButtons({ ...base, status: "sent", genericLinks: [1, 2, 3].map((i) => ({ label: `L${i}`, url: `https://l${i}.example` })) }).length, 3, "routed + max 2 generic");
});

test("6.9 no fee: prefill equals the plain amount due for a gutters and a paint invoice", async () => {
  const { sql } = await freshDb();
  const a = await seedShop(sql, "alpha");
  await setLinks(sql, a.id, { gutters: MX_A_GUTTER, paint: MX_A_PAINT, generic: [{ label: "MX", url: "https://alpha.mxmerchant.com/checkout/other" }] });
  for (const [tmpl, base] of [["tmpl_gutter", MX_A_GUTTER], ["tmpl_ext_paint", MX_A_PAINT]]) {
    const s = await sentInvoice(sql, a, `${tmpl} St`, tmpl);
    let b = await loadInvoice(sql, { kind: "shop", companyId: a.id }, s.invoice.id);
    assert.equal(b.totals.total, 1380);
    assert.ok(b.payButtons[0].href.startsWith(`${base}?`), tmpl);
    for (const btn of b.payButtons) assert.equal(new URL(btn.href).searchParams.get("amt"), "1380.00", tmpl);
    await markInvoicePaid(sql, a.id, s.invoice.id, ACT, { amount: 380.25 });
    b = await loadInvoice(sql, { kind: "shop", companyId: a.id }, s.invoice.id);
    for (const btn of b.payButtons) assert.equal(new URL(btn.href).searchParams.get("amt"), "999.75", "after a partial: plain remaining due");
  }
  for (const f of ["src/lib/housefile/payment.ts", "src/lib/housefile/invoices.ts", "src/components/invoice-panel.tsx", "src/routes/app/settings.tsx"]) {
    const code = (await readFile(join(root, f), "utf8")).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(code, /CARD_FEE|withCardFee|surcharge|card fee|\b0\.03\b|3%/i, f);
  }
});

test("on Paid: status only, no Property Record writeback; opening a link changes nothing", async () => {
  const { sql } = await freshDb();
  const a = await seedShop(sql, "alpha");
  await setLinks(sql, a.id, { gutters: MX_A_GUTTER, generic: [{ label: "Card", url: "https://pay.alpha.example" }] });
  const s = await sentInvoice(sql, a, "1 Main St", "tmpl_gutter");
  const tables = ["jobs", "job_specs", "property_warranties", "properties"];
  const before = {};
  for (const t of tables) before[t] = await count(sql, `select count(*) c from ${t}`, []);
  const b1 = await loadInvoice(sql, { kind: "shop", companyId: a.id }, s.invoice.id);
  assert.equal(b1.invoice.status, "sent", "building buttons does not change status");
  await markInvoicePaid(sql, a.id, s.invoice.id, ACT);
  const b2 = await loadInvoice(sql, { kind: "shop", companyId: a.id }, s.invoice.id);
  assert.equal(b2.invoice.status, "paid");
  assert.deepEqual(b2.payButtons, [], "no Pay button once paid");
  for (const t of tables) assert.equal(await count(sql, `select count(*) c from ${t}`, []), before[t], t);
});

test("6.5/6.8 tenancy: A's invoices resolve only to A's links across work types; never B's", async () => {
  const { sql } = await freshDb();
  const a = await seedShop(sql, "alpha");
  const b = await seedShop(sql, "beta");
  const c = await seedShop(sql, "gamma"); // no links at all
  await setLinks(sql, a.id, { gutters: MX_A_GUTTER, paint: MX_A_PAINT, generic: [{ label: "A card", url: "https://pay.alpha.example" }] });
  await setLinks(sql, b.id, { gutters: MX_B_GUTTER, paint: MX_B_PAINT, generic: [{ label: "B card", url: "https://pay.beta.example" }, { label: "B ach", url: "https://ach.beta.example" }] });
  const bUrls = [MX_B_GUTTER, MX_B_PAINT, "https://pay.beta.example", "https://ach.beta.example"];
  for (const tmpl of ["tmpl_gutter", "tmpl_ext_paint", "tmpl_int_paint", "tmpl_roof", "tmpl_deck", null]) {
    // Same address for A and B; B also has an invoice there.
    const sa = await sentInvoice(sql, a, `7 Shared ${tmpl}`, tmpl);
    const sb = await sentInvoice(sql, b, `7 Shared ${tmpl}`, tmpl);
    const ba = await loadInvoice(sql, { kind: "shop", companyId: a.id }, sa.invoice.id);
    assert.ok(ba.payButtons.length >= 1, String(tmpl));
    for (const btn of ba.payButtons) {
      assert.ok(btn.href.includes("alpha"), `${tmpl}: ${btn.href}`);
      assert.ok(!bUrls.some((u) => btn.href.startsWith(u)), `${tmpl}: leaked ${btn.href}`);
      assert.match(btn.label, /alpha/);
    }
    const bb = await loadInvoice(sql, { kind: "shop", companyId: b.id }, sb.invoice.id);
    for (const btn of bb.payButtons) assert.ok(btn.href.includes("beta"), `${tmpl}: ${btn.href}`);
    // B cannot load A's invoice (and so never sees A's buttons).
    await assert.rejects(loadInvoice(sql, { kind: "shop", companyId: b.id }, sa.invoice.id), /not found/);
  }
  // A shop with no links shows terms text, never another shop's link.
  const sc = await sentInvoice(sql, c, "9 Shared Ln", "tmpl_gutter");
  assert.deepEqual((await loadInvoice(sql, { kind: "shop", companyId: c.id }, sc.invoice.id)).payButtons, []);
  // A proposal override only ever comes from the invoice's own proposal row.
  const so = await sentInvoice(sql, a, "11 Override Rd", "tmpl_ext_paint", "https://override.alpha.example/p");
  const bo = await loadInvoice(sql, { kind: "shop", companyId: a.id }, so.invoice.id);
  assert.equal(bo.payButtons[0].href, "https://override.alpha.example/p");
  // No hardcoded URLs in the resolver code.
  const code = (await readFile(join(root, "src/lib/housefile/payment.ts"), "utf8")).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(code, /https:\/\/[a-z0-9.-]+\.[a-z]{2,}/i);
  assert.doesNotMatch(code, /painting.?plus/i);
});

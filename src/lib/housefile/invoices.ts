/**
 * Invoices (Sprint 1 #5). One invoice per work order, created by the issuing
 * shop from a WO in any status except cancelled; line items are copied from the
 * WO snapshot and stay editable while the invoice is a draft.
 *
 * Money: PlanitService never processes, holds or refunds payments. "Mark paid"
 * is a manual record entered by the shop (invoice_payments), labelled
 * "Marked paid by {Shop} on {date}". Payments and events are append-only; a
 * retraction is a new reversing row. No card fee anywhere; the Pay link is
 * prefilled with the plain amount due.
 *
 * Paid is a status update only: nothing here writes jobs / job_specs or files
 * anything to the Property Record (AC 5.4). Filing stays on accept.
 *
 * Every read and write is scoped by company_id (shop) or by the viewer's
 * entitlement (homeowner / PM). Keep this module free of "@/..." imports so
 * tests can load it with plain Node.
 */
import type { Sql } from "../db";
import { customerCode, mxPaymentUrl, normalizePaymentLink, paymentInvoiceNumber } from "./payment";

export const INVOICE_STATUSES = ["draft", "sent", "partially_paid", "paid", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = ["check", "cash", "card", "ach", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Counsel §5.7: the issuing shop may retract a paid mark within this window. */
export const RETRACT_WINDOW_DAYS = 7;

export type Invoice = {
  id: string;
  company_id: string;
  property_id: string;
  proposal_id: string;
  work_order_id: string;
  seq: number;
  number: string;
  status: InvoiceStatus;
  issue_date: string | null;
  due_date: string | null;
  notes: string | null;
  sent_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  source_item_id: string | null;
  sort_order: number;
  name: string;
  description: string | null;
  qty: number;
  unit: string;
  unit_price: number;
};

export type InvoicePayment = {
  id: string;
  invoice_id: string;
  company_id: string;
  amount: number;
  method: PaymentMethod | null;
  note: string | null;
  paid_on: string;
  reverses_id: string | null;
  actor_user_id: string | null;
  actor_label: string;
  created_at: string;
};

export type InvoiceEvent = {
  id: string;
  invoice_id: string;
  company_id: string;
  actor_user_id: string | null;
  actor_label: string;
  kind: "created" | "updated" | "status" | "payment" | "reversal" | "note";
  from_status: InvoiceStatus | null;
  to_status: InvoiceStatus | null;
  method: string | null;
  note: string | null;
  payment_id: string | null;
  created_at: string;
};

export type InvoiceTotals = { total: number; paid: number; amountDue: number };

export type InvoiceBundle = {
  invoice: Invoice;
  shopName: string;
  items: InvoiceItem[];
  payments: InvoicePayment[];
  events: InvoiceEvent[];
  totals: InvoiceTotals;
  /** Display lines for the payment history ("Marked paid by {Shop} on {date}"). */
  history: string[];
};

/** Who is looking. The shop passes companyId; homeowner/PM pass userId. */
export type InvoiceViewer =
  | { kind: "shop"; companyId: string }
  | { kind: "homeowner"; userId: string }
  | { kind: "pm"; userId: string };

export type Actor = { userId: string | null; label: string };

// ---------------------------------------------------------------- pure helpers

const round2 = (n: number) => Math.round(n * 100) / 100;

export function invoiceSeqLabel(seq: number): string {
  return `INV-${String(seq).padStart(4, "0")}`;
}

export function invoiceStatusLabel(status: InvoiceStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "sent":
      return "Sent";
    case "partially_paid":
      return "Partially paid";
    case "paid":
      return "Paid";
    case "void":
      return "Void";
  }
}

/**
 * Counsel's in-product line. Shown on the invoice view, the invoice email and
 * the PDF, whether or not a Pay link resolves.
 */
export function invoiceNoProcessingLine(shopName: string): string {
  return `Payments go directly to ${shopName}. PlanitService does not process, hold, or refund payments. Contact ${shopName} with payment questions.`;
}

/** Pay button label (Counsel §6.7). */
export function payShopOnlineLabel(shopName: string): string {
  return `Pay ${shopName} online`;
}

function longDate(day: string | null | undefined): string {
  if (!day) return "";
  const d = new Date(`${String(day).slice(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** "Marked paid by {Shop} on {date}" (Counsel §5.7). Never "Paid" alone. */
export function markedPaidLabel(shopName: string, paidOn: string, enteredBy?: string | null): string {
  const base = `Marked paid by ${shopName} on ${longDate(paidOn)}`;
  return enteredBy ? `${base} (entered by ${enteredBy})` : base;
}

export function invoiceTotals(items: Pick<InvoiceItem, "qty" | "unit_price">[], payments: Pick<InvoicePayment, "amount">[]): InvoiceTotals {
  const total = round2(items.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0));
  const paid = round2(payments.reduce((s, p) => s + Number(p.amount), 0));
  return { total, paid, amountDue: round2(Math.max(0, total - paid)) };
}

/** Status implied by recorded payments for a sent (non-draft, non-void) invoice. */
export function statusFromPayments(totals: InvoiceTotals): InvoiceStatus {
  if (totals.total > 0 && totals.paid >= totals.total) return "paid";
  if (totals.paid > 0) return "partially_paid";
  return "sent";
}

export function paymentHistoryLines(shopName: string, payments: InvoicePayment[]): string[] {
  return payments.map((p) => {
    const amt = `$${Math.abs(Number(p.amount)).toFixed(2)}`;
    if (p.reverses_id) {
      return `Paid mark of ${amt} retracted by ${shopName} on ${longDate(String(p.created_at).slice(0, 10))} (entered by ${p.actor_label})`;
    }
    const method = p.method ? ` · ${p.method.toUpperCase() === "ACH" ? "ACH" : p.method}` : "";
    return `${markedPaidLabel(shopName, p.paid_on, p.actor_label)} · ${amt}${method}`;
  });
}

function isoDate(value: string | null | undefined, field: string): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) {
    throw new Error(`Invalid ${field}.`);
  }
  return raw;
}

function money(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid ${field}.`);
  return round2(n);
}

function hydrate(row: Invoice): Invoice {
  const day = (v: unknown) => (v ? String(v).slice(0, 10) : null);
  return { ...row, seq: Number(row.seq), issue_date: day(row.issue_date), due_date: day(row.due_date) };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- data access

async function logEvent(
  sql: Sql,
  inv: Pick<Invoice, "id" | "company_id">,
  actor: Actor,
  kind: InvoiceEvent["kind"],
  fields: Partial<Pick<InvoiceEvent, "from_status" | "to_status" | "method" | "note" | "payment_id">> = {},
) {
  await sql`
    insert into invoice_events (id, invoice_id, company_id, actor_user_id, actor_label, kind, from_status, to_status, method, note, payment_id)
    values (${crypto.randomUUID()}, ${inv.id}, ${inv.company_id}, ${actor.userId}, ${actor.label}, ${kind},
      ${fields.from_status ?? null}, ${fields.to_status ?? null}, ${fields.method ?? null}, ${fields.note ?? null}, ${fields.payment_id ?? null})
  `;
}

async function ownedInvoice(sql: Sql, companyId: string, invoiceId: string): Promise<Invoice> {
  const rows = await sql<Invoice>`select * from invoices where id = ${invoiceId} and company_id = ${companyId} limit 1`;
  if (!rows[0]) throw new Error("Invoice not found");
  return hydrate(rows[0]);
}

/**
 * Create the invoice for a WO the shop owns, or return the existing one.
 * Idempotent (work_order_id UNIQUE). Cancelled WOs cannot be invoiced.
 * number = legacy paymentInvoiceNumber(proposal.id) so any invoice link, PDF or
 * MX memo already sent for this proposal keeps its number; seq is the new
 * per-company sequence.
 */
export async function ensureInvoiceForWorkOrder(
  sql: Sql,
  companyId: string,
  workOrderId: string,
  actor: Actor,
  opts: { dueDate?: string | null } = {},
): Promise<{ invoice: Invoice; created: boolean }> {
  const dueDate = isoDate(opts.dueDate, "due date");
  const wo = (
    await sql<{ id: string; company_id: string; property_id: string; proposal_id: string; status: string }>`
      select id, company_id, property_id, proposal_id, status from work_orders
      where id = ${workOrderId} and company_id = ${companyId} limit 1
    `
  )[0];
  if (!wo) throw new Error("Work order not found");
  const existing = await sql<Invoice>`select * from invoices where work_order_id = ${wo.id} limit 1`;
  if (existing[0]) return { invoice: hydrate(existing[0]), created: false };
  if (wo.status === "cancelled") throw new Error("A cancelled work order can't be invoiced.");

  const seqRow = await sql<{ n: number }>`
    update companies set invoice_seq = invoice_seq + 1 where id = ${companyId} returning invoice_seq as n
  `;
  const seq = Number(seqRow[0]?.n ?? 0);
  if (!seq) throw new Error("Shop not found");
  const id = crypto.randomUUID();
  const issue = todayIso();
  if (dueDate && dueDate < issue) throw new Error("Due date is before the issue date.");
  const inserted = await sql<Invoice>`
    insert into invoices (id, company_id, property_id, proposal_id, work_order_id, seq, number, issue_date, due_date)
    values (${id}, ${companyId}, ${wo.property_id}, ${wo.proposal_id}, ${wo.id}, ${seq},
      ${paymentInvoiceNumber(wo.proposal_id)}, ${issue}::date, ${dueDate}::date)
    on conflict (work_order_id) do nothing
    returning *
  `;
  if (!inserted[0]) {
    const raced = await sql<Invoice>`select * from invoices where work_order_id = ${wo.id} limit 1`;
    if (!raced[0]) throw new Error("Invoice not found");
    return { invoice: hydrate(raced[0]), created: false };
  }
  await sql`
    insert into invoice_items (id, invoice_id, source_item_id, sort_order, name, description, qty, unit, unit_price)
    select md5(${id} || ':' || w.id), ${id}, w.id, w.sort_order, w.name, w.description, w.qty, w.unit, w.unit_price
    from work_order_items w where w.work_order_id = ${wo.id}
    order by w.sort_order
  `;
  const invoice = hydrate(inserted[0]);
  await logEvent(sql, invoice, actor, "created", { to_status: "draft" });
  return { invoice, created: true };
}

export type InvoiceItemInput = {
  name: string;
  description?: string | null;
  qty: number;
  unit?: string | null;
  unit_price: number;
};

export type InvoicePatch = {
  dueDate?: string | null;
  notes?: string | null;
  items?: InvoiceItemInput[];
};

/** Edit a draft. Line items are replaced wholesale; sent/paid/void are locked. */
export async function updateDraftInvoice(
  sql: Sql,
  companyId: string,
  invoiceId: string,
  patch: InvoicePatch,
  actor: Actor,
): Promise<Invoice> {
  const inv = await ownedInvoice(sql, companyId, invoiceId);
  if (inv.status !== "draft") throw new Error("Only a draft invoice can be edited.");
  const due = patch.dueDate === undefined ? inv.due_date : isoDate(patch.dueDate, "due date");
  if (due && inv.issue_date && due < inv.issue_date) throw new Error("Due date is before the issue date.");
  if (patch.items) {
    const items = patch.items.map((i, idx) => {
      const name = (i.name ?? "").trim();
      if (!name) throw new Error("Every line needs a name.");
      return {
        name,
        description: i.description?.trim() || null,
        qty: money(i.qty, "quantity"),
        unit: i.unit?.trim() || "ls",
        unit_price: money(i.unit_price, "price"),
        sort_order: idx + 1,
      };
    });
    await sql`delete from invoice_items where invoice_id = ${inv.id}`;
    for (const i of items) {
      await sql`
        insert into invoice_items (id, invoice_id, sort_order, name, description, qty, unit, unit_price)
        values (${crypto.randomUUID()}, ${inv.id}, ${i.sort_order}, ${i.name}, ${i.description}, ${i.qty}, ${i.unit}, ${i.unit_price})
      `;
    }
  }
  const notes = patch.notes === undefined ? inv.notes : patch.notes?.trim() || null;
  const rows = await sql<Invoice>`
    update invoices set due_date = ${due}::date, notes = ${notes}, updated_at = now()
    where id = ${inv.id} and company_id = ${companyId} returning *
  `;
  await logEvent(sql, inv, actor, "updated");
  return hydrate(rows[0]);
}

async function setStatus(sql: Sql, inv: Invoice, to: InvoiceStatus, actor: Actor, extra: Partial<Pick<InvoiceEvent, "method" | "note" | "payment_id">> = {}) {
  if (inv.status === to) return inv;
  const rows = await sql<Invoice>`
    update invoices set
      status = ${to},
      sent_at = case when ${to} = 'sent' and sent_at is null then now() else sent_at end,
      paid_at = case when ${to} = 'paid' then coalesce(paid_at, now()) when ${to} in ('sent','partially_paid') then null else paid_at end,
      voided_at = case when ${to} = 'void' then now() else voided_at end,
      updated_at = now()
    where id = ${inv.id} and company_id = ${inv.company_id} returning *
  `;
  await logEvent(sql, inv, actor, "status", { from_status: inv.status, to_status: to, ...extra });
  return hydrate(rows[0]);
}

/** Draft → Sent. Requires at least one line and a positive total. */
export async function markInvoiceSent(sql: Sql, companyId: string, invoiceId: string, actor: Actor): Promise<Invoice> {
  const inv = await ownedInvoice(sql, companyId, invoiceId);
  if (inv.status === "sent") return inv;
  if (inv.status !== "draft") throw new Error("Only a draft invoice can be sent.");
  const items = await sql<InvoiceItem>`select qty, unit_price from invoice_items where invoice_id = ${inv.id}`;
  if (invoiceTotals(items, []).total <= 0) throw new Error("Add at least one priced line before sending.");
  return setStatus(sql, inv, "sent", actor);
}

/** Void from draft or sent (no recorded payments). Payments are never deleted. */
export async function voidInvoice(sql: Sql, companyId: string, invoiceId: string, actor: Actor, note?: string | null): Promise<Invoice> {
  const inv = await ownedInvoice(sql, companyId, invoiceId);
  if (inv.status === "void") return inv;
  if (inv.status !== "draft" && inv.status !== "sent") {
    throw new Error("Retract recorded payments before voiding this invoice.");
  }
  return setStatus(sql, inv, "void", actor, { note: note?.trim() || null });
}

async function totalsFor(sql: Sql, invoiceId: string) {
  const items = await sql<InvoiceItem>`select qty, unit_price from invoice_items where invoice_id = ${invoiceId}`;
  const payments = await sql<InvoicePayment>`select amount from invoice_payments where invoice_id = ${invoiceId}`;
  return invoiceTotals(items, payments);
}

/**
 * "Mark paid" (manual). Records an append-only payment row and an event, then
 * recomputes status from the payments. amount defaults to the full amount due.
 * Status-only: no jobs / job_specs / filing writes (AC 5.4).
 */
export async function markInvoicePaid(
  sql: Sql,
  companyId: string,
  invoiceId: string,
  actor: Actor,
  input: { amount?: number | null; method?: string | null; note?: string | null; paidOn?: string | null } = {},
): Promise<{ invoice: Invoice; payment: InvoicePayment }> {
  const inv = await ownedInvoice(sql, companyId, invoiceId);
  if (inv.status === "draft") throw new Error("Send the invoice before marking it paid.");
  if (inv.status === "void") throw new Error("A void invoice can't be marked paid.");
  if (inv.status === "paid") throw new Error("This invoice is already marked paid.");
  const method = (input.method ?? "").trim().toLowerCase() || null;
  if (method && !PAYMENT_METHODS.includes(method as PaymentMethod)) throw new Error("Invalid payment method.");
  const before = await totalsFor(sql, inv.id);
  const amount = input.amount == null ? before.amountDue : money(input.amount, "amount");
  if (amount <= 0) throw new Error("Amount must be more than zero.");
  if (amount > before.amountDue) throw new Error("Amount is more than the amount due.");
  const paidOn = isoDate(input.paidOn, "payment date") ?? todayIso();
  const id = crypto.randomUUID();
  const note = input.note?.trim() || null;
  const rows = await sql<InvoicePayment>`
    insert into invoice_payments (id, invoice_id, company_id, amount, method, note, paid_on, actor_user_id, actor_label)
    values (${id}, ${inv.id}, ${companyId}, ${amount}, ${method}, ${note}, ${paidOn}::date, ${actor.userId}, ${actor.label})
    returning *
  `;
  await logEvent(sql, inv, actor, "payment", { method, note, payment_id: id });
  const next = statusFromPayments(await totalsFor(sql, inv.id));
  const invoice = await setStatus(sql, inv, next, actor, { method, payment_id: id });
  return { invoice, payment: { ...rows[0], amount: Number(rows[0].amount) } };
}

/**
 * Retract a paid mark by appending a reversing row (Counsel §5.7). Only within
 * RETRACT_WINDOW_DAYS of the original entry; after that, use addInvoiceNote.
 */
export async function retractInvoicePayment(
  sql: Sql,
  companyId: string,
  paymentId: string,
  actor: Actor,
  note?: string | null,
  now: Date = new Date(),
): Promise<Invoice> {
  const original = (
    await sql<InvoicePayment>`
      select * from invoice_payments where id = ${paymentId} and company_id = ${companyId} limit 1
    `
  )[0];
  if (!original || original.reverses_id || Number(original.amount) <= 0) throw new Error("Payment not found");
  const ageMs = now.getTime() - new Date(original.created_at).getTime();
  if (ageMs > RETRACT_WINDOW_DAYS * 86400000) {
    throw new Error(`Paid marks can only be retracted within ${RETRACT_WINDOW_DAYS} days. Add a note instead.`);
  }
  const already = await sql`select 1 from invoice_payments where reverses_id = ${original.id} limit 1`;
  if (already[0]) throw new Error("This paid mark was already retracted.");
  const inv = await ownedInvoice(sql, companyId, original.invoice_id);
  const id = crypto.randomUUID();
  const text = note?.trim() || null;
  await sql`
    insert into invoice_payments (id, invoice_id, company_id, amount, method, note, paid_on, reverses_id, actor_user_id, actor_label)
    values (${id}, ${inv.id}, ${companyId}, ${-Number(original.amount)}, ${original.method}, ${text},
      ${now.toISOString().slice(0, 10)}::date, ${original.id}, ${actor.userId}, ${actor.label})
  `;
  await logEvent(sql, inv, actor, "reversal", { note: text, payment_id: id });
  return setStatus(sql, inv, statusFromPayments(await totalsFor(sql, inv.id)), actor, { payment_id: id });
}

/** Append-only amend note (the only correction after the retract window). */
export async function addInvoiceNote(sql: Sql, companyId: string, invoiceId: string, actor: Actor, note: string) {
  const inv = await ownedInvoice(sql, companyId, invoiceId);
  const text = note.trim();
  if (!text) throw new Error("Note is empty.");
  await logEvent(sql, inv, actor, "note", { note: text });
}

async function shopName(sql: Sql, companyId: string): Promise<string> {
  const rows = await sql<{ name: string }>`select name from companies where id = ${companyId} limit 1`;
  return rows[0]?.name ?? "the shop";
}

async function bundle(sql: Sql, invoice: Invoice, includeEvents: boolean): Promise<InvoiceBundle> {
  const items = (
    await sql<InvoiceItem>`select * from invoice_items where invoice_id = ${invoice.id} order by sort_order, name`
  ).map((i) => ({ ...i, qty: Number(i.qty), unit_price: Number(i.unit_price), sort_order: Number(i.sort_order) }));
  const payments = (
    await sql<InvoicePayment>`
      select * from invoice_payments where invoice_id = ${invoice.id} and company_id = ${invoice.company_id}
      order by created_at, id
    `
  ).map((p) => ({ ...p, amount: Number(p.amount), paid_on: String(p.paid_on).slice(0, 10) }));
  const events = includeEvents
    ? await sql<InvoiceEvent>`
        select * from invoice_events where invoice_id = ${invoice.id} and company_id = ${invoice.company_id}
        order by created_at, id
      `
    : [];
  const name = await shopName(sql, invoice.company_id);
  return {
    invoice,
    shopName: name,
    items,
    payments,
    events,
    totals: invoiceTotals(items, payments),
    history: paymentHistoryLines(name, payments),
  };
}

/**
 * May this viewer see this invoice? Shop: same company_id. Homeowner: owns the
 * invoice's property row, or a row at the same address. PM: a paid Portfolio
 * they own or are a member of contains that property row or a row at the same
 * address (copied rows live on the viewer's own property row, never via the
 * shop's company_id). Everyone else: no.
 */
/**
 * Rows the invoice is explicitly attached to: the issuing shop's row, plus
 * every File row that got a copy of the same accepted job (jobs.proposal_id,
 * written on accept / 0031). No address-text matching here.
 */
const LINKED_ROWS = (sql: Sql, invoice: Pick<Invoice, "property_id" | "proposal_id">) => sql`
  select ${invoice.property_id}::text as id
  union
  select j.property_id from jobs j where j.proposal_id = ${invoice.proposal_id}
`;

/** Same entitlement rules as search.server.ts (feat/search-api). */
async function entitledRow(sql: Sql, viewer: Exclude<InvoiceViewer, { kind: "shop" }>, propertyId: string) {
  if (viewer.kind === "homeowner") {
    const rows = await sql`select 1 from properties where id = ${propertyId} and homeowner_user_id = ${viewer.userId} limit 1`;
    return Boolean(rows[0]);
  }
  const rows = await sql`
    select 1 from portfolio_properties pp
    join portfolios pf on pf.id = pp.portfolio_id and pf.paid_at is not null
    where pp.property_id = ${propertyId}
      and (pf.user_id = ${viewer.userId}
        or exists (select 1 from portfolio_members m where m.portfolio_id = pf.id and m.user_id = ${viewer.userId}))
    limit 1
  `;
  return Boolean(rows[0]);
}

async function viewerMaySee(
  sql: Sql,
  viewer: InvoiceViewer,
  invoice: Pick<Invoice, "company_id" | "property_id" | "proposal_id">,
): Promise<boolean> {
  if (viewer.kind === "shop") return viewer.companyId === invoice.company_id;
  const linked = await LINKED_ROWS(sql, invoice);
  for (const row of linked as unknown as { id: string }[]) {
    if (await entitledRow(sql, viewer, row.id)) return true;
  }
  return false;
}

/**
 * Load an invoice for a viewer. Shop: full bundle with events. Homeowner / PM:
 * items, totals and payment history (read-only), no internal events. Anyone
 * else (including another shop) gets "not found", never a partial row.
 * Drafts are visible only to the shop.
 */
export async function loadInvoice(sql: Sql, viewer: InvoiceViewer, invoiceId: string): Promise<InvoiceBundle> {
  const rows = await sql<Invoice>`select * from invoices where id = ${invoiceId} limit 1`;
  const invoice = rows[0] ? hydrate(rows[0]) : null;
  if (!invoice || !(await viewerMaySee(sql, viewer, invoice))) throw new Error("Invoice not found");
  if (viewer.kind !== "shop" && invoice.status === "draft") throw new Error("Invoice not found");
  return bundle(sql, invoice, viewer.kind === "shop");
}

/** Shop's invoice for one of its WOs, or null. */
export async function loadInvoiceForWorkOrder(sql: Sql, companyId: string, workOrderId: string): Promise<InvoiceBundle | null> {
  const rows = await sql<Invoice>`
    select * from invoices where work_order_id = ${workOrderId} and company_id = ${companyId} limit 1
  `;
  return rows[0] ? bundle(sql, hydrate(rows[0]), true) : null;
}

export type InvoiceSummary = {
  id: string;
  shopName: string;
  seq: number;
  number: string;
  status: InvoiceStatus;
  due_date: string | null;
  total: number;
  amountDue: number;
};

/**
 * Non-draft invoices on a property for the homeowner or an entitled PM
 * (/home, portfolio file). Empty for anyone else. Read-only.
 */
export async function listInvoicesForProperty(
  sql: Sql,
  viewer: Exclude<InvoiceViewer, { kind: "shop" }>,
  propertyId: string,
): Promise<InvoiceSummary[]> {
  // propertyId is the viewer's own row. Invoices reach it only through the
  // explicit job copy for the same proposal, never through address text.
  if (!(await entitledRow(sql, viewer, propertyId))) return [];
  const rows = await sql<Invoice>`
    select i.* from invoices i
    where i.status <> 'draft'
      and (i.property_id = ${propertyId}
        or exists (select 1 from jobs j where j.proposal_id = i.proposal_id and j.property_id = ${propertyId}))
    order by i.created_at
  `;
  const out: InvoiceSummary[] = [];
  for (const row of rows) {
    if (!(await viewerMaySee(sql, viewer, row))) continue;
    const b = await bundle(sql, hydrate(row), false);
    out.push({
      id: b.invoice.id,
      shopName: b.shopName,
      seq: b.invoice.seq,
      number: b.invoice.number,
      status: b.invoice.status,
      due_date: b.invoice.due_date,
      total: b.totals.total,
      amountDue: b.totals.amountDue,
    });
  }
  return out;
}

// ---------------------------------------------------------------- email / PDF text

/** Plain-text body shared by the invoice email and PDF footer. */
export function renderInvoiceText(input: {
  shopName: string;
  seq: number;
  number: string;
  dueDate: string | null;
  amountDue: number;
  payUrl: string | null;
  propertyAddress: string;
}): string {
  const lines = [
    `Invoice ${invoiceSeqLabel(input.seq)} (# ${input.number}) from ${input.shopName}`,
    `Property: ${input.propertyAddress}`,
    `Amount due: $${input.amountDue.toFixed(2)}`,
    input.dueDate ? `Due: ${longDate(input.dueDate)}` : null,
    input.payUrl ? `${payShopOnlineLabel(input.shopName)}: ${input.payUrl}` : `Contact ${input.shopName} for payment terms.`,
    "",
    invoiceNoProcessingLine(input.shopName),
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

/**
 * Pay link for an invoice, prefilled with the plain amount due (no fee).
 * Resolves only from the issuing shop's own fields: the proposal's per-estimate
 * link (itself set from that shop's settings), else that shop's payment_link.
 * Never another company's link. Null when nothing resolves or nothing is due.
 */
export function invoicePayUrl(input: {
  proposalPaymentLink: string | null | undefined;
  shopPaymentLink: string | null | undefined;
  invoiceNumber: string;
  amountDue: number;
  inviteToken?: string | null;
  propertyId: string;
}): string | null {
  if (input.amountDue <= 0) return null;
  const code = customerCode(input.inviteToken || input.propertyId);
  return mxPaymentUrl(normalizePaymentLink(input.proposalPaymentLink || input.shopPaymentLink), {
    amount: input.amountDue,
    invoiceNumber: input.invoiceNumber,
    customerCode: code,
    memo: `Customer ${code} · invoice ${input.invoiceNumber}`,
  });
}

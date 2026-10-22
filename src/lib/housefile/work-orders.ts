/**
 * Work orders (Sprint 1 #4). One WO per proposal, created when the estimate is
 * accepted and kept in sync with the legacy proposal columns:
 *
 *   WO start_date   <-> proposals.scheduled_on
 *   WO in_progress   -> proposals.started_work_at (first time only)
 *   WO complete     <-> proposals.status = 'completed'
 *
 * Nothing here writes to the Property Record (jobs / job_specs). Filing stays
 * on accept (writeAcceptedWorkToFiles in server.ts).
 *
 * Every read and write is scoped by company_id. Keep this module free of
 * "@/..." imports so scripts (backfill, tests) can load it with plain Node.
 */
import type { Sql } from "../db";

export const WORK_ORDER_STATUSES = ["scheduled", "in_progress", "complete", "cancelled"] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export type WorkOrder = {
  id: string;
  company_id: string;
  property_id: string;
  proposal_id: string;
  number: number;
  assignee: string | null;
  assignee_member_id: string | null;
  start_date: string | null;
  end_date: string | null;
  status: WorkOrderStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkOrderItem = {
  id: string;
  work_order_id: string;
  source_item_id: string | null;
  sort_order: number;
  name: string;
  description: string | null;
  qty: number;
  unit: string;
  unit_price: number;
  manufacturer: string | null;
  product_name: string | null;
  sku: string | null;
  color: string | null;
  location_note: string | null;
  warranty_years: number | null;
  warranty_terms: string | null;
};

export type WorkOrderEvent = {
  id: string;
  work_order_id: string;
  company_id: string;
  actor: string;
  kind: "created" | "status" | "updated";
  from_status: WorkOrderStatus | null;
  to_status: WorkOrderStatus | null;
  detail: string | null;
  created_at: string;
};

export type WorkOrderBundle = {
  workOrder: WorkOrder;
  items: WorkOrderItem[];
  events: WorkOrderEvent[];
};

/** What PMs and homeowners may see on the File: status only, no notes. */
export type WorkOrderPublicStatus = {
  number: number;
  status: WorkOrderStatus;
  start_date: string | null;
  end_date: string | null;
};

const NEXT: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  scheduled: ["in_progress", "complete", "cancelled"],
  in_progress: ["complete", "cancelled"],
  complete: [],
  cancelled: [],
};

export function workOrderStatusLabel(status: WorkOrderStatus): string {
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "in_progress":
      return "In progress";
    case "complete":
      return "Complete";
    case "cancelled":
      return "Cancelled";
  }
}

export function workOrderNumberLabel(number: number): string {
  return `WO-${String(number).padStart(4, "0")}`;
}

export function nextWorkOrderStatuses(status: WorkOrderStatus): WorkOrderStatus[] {
  return NEXT[status] ?? [];
}

export function canTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return nextWorkOrderStatuses(from).includes(to);
}

function isStatus(value: string): value is WorkOrderStatus {
  return (WORK_ORDER_STATUSES as readonly string[]).includes(value);
}

function isoDate(value: string | null | undefined): string | null {
  if (value == null) return null;
  const s = String(value).trim().slice(0, 10);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Need a real date.");
  const t = Date.parse(`${s}T12:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== s) {
    throw new Error("Need a real date.");
  }
  return s;
}

function hydrate(row: WorkOrder): WorkOrder {
  return {
    ...row,
    number: Number(row.number),
    start_date: row.start_date ? String(row.start_date).slice(0, 10) : null,
    end_date: row.end_date ? String(row.end_date).slice(0, 10) : null,
  };
}

async function logEvent(
  sql: Sql,
  wo: Pick<WorkOrder, "id" | "company_id">,
  actor: string,
  kind: WorkOrderEvent["kind"],
  fromStatus: WorkOrderStatus | null,
  toStatus: WorkOrderStatus | null,
  detail: string | null,
) {
  await sql`
    insert into work_order_events (id, work_order_id, company_id, actor, kind, from_status, to_status, detail)
    values (${crypto.randomUUID()}, ${wo.id}, ${wo.company_id}, ${actor}, ${kind}, ${fromStatus}, ${toStatus}, ${detail})
  `;
}

/**
 * Create the WO for an accepted/completed proposal, or return the one that
 * exists. Idempotent: proposal_id is UNIQUE, so a repeat (double accept,
 * backfill re-run, "Create work order" click) never makes a second.
 * Returns null when the proposal is not sold yet.
 */
export async function ensureWorkOrder(
  sql: Sql,
  proposalId: string,
  actor: string,
): Promise<{ workOrder: WorkOrder; created: boolean } | null> {
  const existing = await sql<WorkOrder>`select * from work_orders where proposal_id = ${proposalId} limit 1`;
  if (existing[0]) return { workOrder: hydrate(existing[0]), created: false };
  const proposal = (
    await sql<{
      id: string;
      company_id: string;
      property_id: string;
      status: string;
      scheduled_on: string | null;
    }>`select id, company_id, property_id, status, scheduled_on from proposals where id = ${proposalId} limit 1`
  )[0];
  if (!proposal) throw new Error("Proposal not found");
  if (proposal.status !== "accepted" && proposal.status !== "completed") return null;

  const seq = await sql<{ n: number }>`
    update companies set work_order_seq = work_order_seq + 1
    where id = ${proposal.company_id}
    returning work_order_seq as n
  `;
  const number = Number(seq[0]?.n ?? 0);
  if (!number) throw new Error("Shop not found");
  const status: WorkOrderStatus = proposal.status === "completed" ? "complete" : "scheduled";
  const id = crypto.randomUUID();
  const inserted = await sql<WorkOrder>`
    insert into work_orders (id, company_id, property_id, proposal_id, number, status, start_date)
    values (
      ${id}, ${proposal.company_id}, ${proposal.property_id}, ${proposal.id}, ${number},
      ${status}, ${proposal.scheduled_on ? String(proposal.scheduled_on).slice(0, 10) : null}::date
    )
    on conflict (proposal_id) do nothing
    returning *
  `;
  if (!inserted[0]) {
    const raced = await sql<WorkOrder>`select * from work_orders where proposal_id = ${proposalId} limit 1`;
    return raced[0] ? { workOrder: hydrate(raced[0]), created: false } : null;
  }
  await sql`
    insert into work_order_items (
      id, work_order_id, source_item_id, sort_order, name, description, qty, unit, unit_price,
      manufacturer, product_name, sku, color, location_note, warranty_years, warranty_terms
    )
    select
      md5(${id} || ':' || pi.id), ${id}, pi.id, pi.sort_order, pi.name, pi.description, pi.qty, pi.unit,
      pi.unit_price, pi.manufacturer, pi.product_name, pi.sku, pi.color, pi.location_note,
      pi.warranty_years, pi.warranty_terms
    from proposal_items pi
    where pi.proposal_id = ${proposal.id} and pi.included = true
    order by pi.sort_order
  `;
  const wo = hydrate(inserted[0]);
  await logEvent(sql, wo, actor, "created", null, status, null);
  return { workOrder: wo, created: true };
}

async function ownedWorkOrder(sql: Sql, companyId: string, workOrderId: string): Promise<WorkOrder> {
  const rows = await sql<WorkOrder>`
    select * from work_orders where id = ${workOrderId} and company_id = ${companyId} limit 1
  `;
  if (!rows[0]) throw new Error("Work order not found");
  return hydrate(rows[0]);
}

/** Full WO for the shop that owns it. Another shop gets "not found". */
export async function loadWorkOrderForCompany(
  sql: Sql,
  companyId: string,
  workOrderId: string,
): Promise<WorkOrderBundle> {
  const workOrder = await ownedWorkOrder(sql, companyId, workOrderId);
  return loadBundle(sql, workOrder);
}

/** Shop's WO for one of its own proposals, or null when none exists yet. */
export async function loadWorkOrderForProposal(
  sql: Sql,
  companyId: string,
  proposalId: string,
): Promise<WorkOrderBundle | null> {
  const rows = await sql<WorkOrder>`
    select * from work_orders where proposal_id = ${proposalId} and company_id = ${companyId} limit 1
  `;
  if (!rows[0]) return null;
  return loadBundle(sql, hydrate(rows[0]));
}

async function loadBundle(sql: Sql, workOrder: WorkOrder): Promise<WorkOrderBundle> {
  const items = await sql<WorkOrderItem>`
    select * from work_order_items where work_order_id = ${workOrder.id} order by sort_order, name
  `;
  const events = await sql<WorkOrderEvent>`
    select * from work_order_events
    where work_order_id = ${workOrder.id} and company_id = ${workOrder.company_id}
    order by created_at, id
  `;
  return {
    workOrder,
    items: items.map((i) => ({
      ...i,
      qty: Number(i.qty),
      unit_price: Number(i.unit_price),
      sort_order: Number(i.sort_order),
      warranty_years: i.warranty_years == null ? null : Number(i.warranty_years),
    })),
    events,
  };
}

/** Status-only view (no notes, no assignee) for the homeowner / PM File. */
export async function workOrderStatusForProposal(
  sql: Sql,
  proposalId: string,
): Promise<WorkOrderPublicStatus | null> {
  const rows = await sql<WorkOrder>`
    select number, status, start_date, end_date from work_orders where proposal_id = ${proposalId} limit 1
  `;
  if (!rows[0]) return null;
  const wo = hydrate(rows[0]);
  return { number: wo.number, status: wo.status, start_date: wo.start_date, end_date: wo.end_date };
}

/**
 * Move a WO along scheduled -> in_progress -> complete, or cancel it from any
 * non-complete state. Writes one activity row and syncs the proposal columns.
 * Never touches jobs (the Property Record).
 */
export async function setWorkOrderStatus(
  sql: Sql,
  companyId: string,
  workOrderId: string,
  to: string,
  actor: string,
): Promise<WorkOrder> {
  if (!isStatus(to)) throw new Error("Unknown work order status");
  const wo = await ownedWorkOrder(sql, companyId, workOrderId);
  if (wo.status === to) return wo;
  if (!canTransition(wo.status, to)) {
    throw new Error(
      `A ${workOrderStatusLabel(wo.status).toLowerCase()} work order cannot move to ${workOrderStatusLabel(to).toLowerCase()}.`,
    );
  }
  const updated = await sql<WorkOrder>`
    update work_orders set status = ${to}, updated_at = now()
    where id = ${wo.id} and company_id = ${companyId} and status = ${wo.status}
    returning *
  `;
  if (!updated[0]) throw new Error("Work order changed. Reload and try again.");
  await logEvent(sql, wo, actor, "status", wo.status, to, null);
  if (to === "in_progress") {
    await sql`
      update proposals set started_work_at = coalesce(started_work_at, now())
      where id = ${wo.proposal_id} and company_id = ${companyId}
    `;
  }
  if (to === "complete") {
    await sql`
      update proposals set status = ${"completed"}
      where id = ${wo.proposal_id} and company_id = ${companyId}
    `;
  }
  return hydrate(updated[0]);
}

/**
 * Legacy "mark job complete" entry point (completeProposal). Makes sure the WO
 * exists and lands on complete, so the proposal and WO agree.
 */
export async function completeWorkOrderForProposal(
  sql: Sql,
  companyId: string,
  proposalId: string,
  actor: string,
): Promise<WorkOrder | null> {
  const ensured = await ensureWorkOrder(sql, proposalId, actor);
  if (!ensured) return null;
  const wo = ensured.workOrder;
  if (wo.company_id !== companyId) throw new Error("Work order not found");
  if (wo.status === "cancelled") throw new Error("This work order was cancelled.");
  if (wo.status === "complete") {
    await sql`update proposals set status = ${"completed"} where id = ${proposalId} and company_id = ${companyId}`;
    return wo;
  }
  return setWorkOrderStatus(sql, companyId, wo.id, "complete", actor);
}

export type WorkOrderPatch = {
  assignee?: string | null;
  assigneeMemberId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
};

/** Edit assignee, dates, notes. Start date mirrors to proposals.scheduled_on. */
export async function updateWorkOrderFields(
  sql: Sql,
  companyId: string,
  workOrderId: string,
  patch: WorkOrderPatch,
  actor: string,
): Promise<WorkOrder> {
  const wo = await ownedWorkOrder(sql, companyId, workOrderId);
  if (wo.status === "complete" || wo.status === "cancelled") {
    throw new Error("This work order is closed.");
  }
  let assigneeMemberId = wo.assignee_member_id;
  let assignee = wo.assignee;
  if (patch.assigneeMemberId !== undefined) {
    assigneeMemberId = patch.assigneeMemberId || null;
    if (assigneeMemberId) {
      const member = await sql<{ id: string; email: string }>`
        select id, email from company_members where id = ${assigneeMemberId} and company_id = ${companyId} limit 1
      `;
      if (!member[0]) throw new Error("Pick someone on your team.");
      if (patch.assignee === undefined) assignee = member[0].email;
    }
  }
  if (patch.assignee !== undefined) assignee = patch.assignee?.trim() || null;
  if (assignee && assignee.length > 120) throw new Error("Keep the assignee under 120 characters.");
  const startDate = patch.startDate !== undefined ? isoDate(patch.startDate) : wo.start_date;
  const endDate = patch.endDate !== undefined ? isoDate(patch.endDate) : wo.end_date;
  if (startDate && endDate && endDate < startDate) throw new Error("End date is before the start date.");
  const notes = patch.notes !== undefined ? patch.notes?.trim() || null : wo.notes;
  if (notes && notes.length > 4000) throw new Error("Keep notes under 4,000 characters.");

  const changes: string[] = [];
  if (assignee !== wo.assignee || assigneeMemberId !== wo.assignee_member_id) {
    changes.push(`assignee: ${assignee ?? "none"}`);
  }
  if (startDate !== wo.start_date) changes.push(`start: ${startDate ?? "none"}`);
  if (endDate !== wo.end_date) changes.push(`end: ${endDate ?? "none"}`);
  if (notes !== wo.notes) changes.push("notes");
  if (changes.length === 0) return wo;

  const updated = await sql<WorkOrder>`
    update work_orders
    set assignee = ${assignee}, assignee_member_id = ${assigneeMemberId},
        start_date = ${startDate}::date, end_date = ${endDate}::date,
        notes = ${notes}, updated_at = now()
    where id = ${wo.id} and company_id = ${companyId}
    returning *
  `;
  if (startDate !== wo.start_date && startDate) {
    await sql`
      update proposals set scheduled_on = ${startDate}::date
      where id = ${wo.proposal_id} and company_id = ${companyId}
    `;
  }
  await logEvent(sql, wo, actor, "updated", null, null, `Changed ${changes.join(", ")}`);
  return hydrate(updated[0]!);
}

/** Legacy schedule path (scheduleSoldEstimate) mirrors into the WO. */
export async function syncWorkOrderStartFromProposal(
  sql: Sql,
  companyId: string,
  proposalId: string,
  scheduledOn: string,
  actor: string,
): Promise<void> {
  const rows = await sql<WorkOrder>`
    select * from work_orders where proposal_id = ${proposalId} and company_id = ${companyId} limit 1
  `;
  const wo = rows[0] ? hydrate(rows[0]) : null;
  if (!wo || wo.status === "complete" || wo.status === "cancelled") return;
  const day = isoDate(scheduledOn);
  if (!day || day === wo.start_date) return;
  const end = wo.end_date && wo.end_date < day ? null : wo.end_date;
  await sql`
    update work_orders set start_date = ${day}::date, end_date = ${end}::date, updated_at = now()
    where id = ${wo.id} and company_id = ${companyId}
  `;
  await logEvent(sql, wo, actor, "updated", null, null, `Changed start: ${day}`);
}

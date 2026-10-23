/**
 * Related-records preview for a highlighted search hit (Sprint 1 #3, AC 3.3).
 *
 * Same scoping as search (search.server.ts SCOPE_SQL), enforced in SQL:
 *   - Entitled row (properties.homeowner_user_id, or a paid portfolio the caller
 *     owns / belongs to via portfolio_properties): every estimate and job on
 *     that row, including ones a shop copied onto it.
 *   - Shop row (properties.company_id = caller's shop): only that shop's own
 *     estimates and jobs.
 *   - Anything else: null (the route answers 404, so ids can't be probed).
 *
 * Work orders and invoices are not on this branch yet (WO: feat/work-orders,
 * invoices: Sprint 1 #5); the payload reports them as null so the UI can say so.
 *
 * Keep free of "@/..." runtime imports so tests load it with plain Node.
 */
import type { Sql } from "../db";
import type { SearchViewer } from "./search.server";

export const OPEN_ESTIMATE_STATUSES = ["draft", "pending", "sent", "revised"] as const;
const PREVIEW_LIMIT = 5;

export type SearchPreview = {
  property: {
    id: string;
    address_line: string;
    city: string;
    state: string;
    zip: string;
    homeowner_name: string;
    homeowner_email: string;
    homeowner_phone: string | null;
  };
  open_estimates: { id: string; title: string; status: string; created_at: string }[];
  recent_jobs: { id: string; title: string; completed_at: string }[];
  open_work_orders: null;
  unpaid_invoices: null;
  last_activity_at: string | null;
};

type Access = "entitled" | "shop";

async function accessFor(sql: Sql, viewer: SearchViewer, propertyId: string): Promise<Access | null> {
  const rows = await sql<{ entitled: boolean; shop: boolean }>`
    select
      (p.homeowner_user_id = ${viewer.userId}
       or exists (
         select 1 from portfolio_properties pp
         join portfolios pf on pf.id = pp.portfolio_id
         where pp.property_id = p.id and pf.paid_at is not null
           and (pf.user_id = ${viewer.userId}
                or exists (select 1 from portfolio_members m
                           where m.portfolio_id = pf.id and m.user_id = ${viewer.userId}))
       )) as entitled,
      (${viewer.companyId}::text is not null and p.company_id = ${viewer.companyId}::text) as shop
    from properties p
    where p.id = ${propertyId}
  `;
  const r = rows[0];
  if (!r) return null;
  if (r.entitled) return "entitled";
  if (r.shop) return "shop";
  return null;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));

export async function searchPreview(
  sql: Sql,
  viewer: SearchViewer,
  propertyId: string,
): Promise<SearchPreview | null> {
  if (!propertyId || propertyId.length > 200) return null;
  const access = await accessFor(sql, viewer, propertyId);
  if (!access) return null;
  // null company filter = every record on an entitled row.
  const company = access === "shop" ? viewer.companyId : null;

  const [prop] = await sql<SearchPreview["property"]>`
    select id, address_line, city, state, zip, homeowner_name, homeowner_email, homeowner_phone
    from properties where id = ${propertyId}
  `;
  const estimates = await sql<{ id: string; title: string; status: string; created_at: unknown }>`
    select id, title, status, created_at from proposals
    where property_id = ${propertyId}
      and (${company}::text is null or company_id = ${company}::text)
      and status in ('draft', 'pending', 'sent', 'revised') -- OPEN_ESTIMATE_STATUSES
    order by created_at desc
    limit ${PREVIEW_LIMIT}
  `;
  const jobs = await sql<{ id: string; title: string; completed_at: unknown }>`
    select id, title, completed_at from jobs
    where property_id = ${propertyId}
      and (${company}::text is null or company_id = ${company}::text)
    order by completed_at desc, created_at desc
    limit ${PREVIEW_LIMIT}
  `;
  const [last] = await sql<{ at: unknown }>`
    select max(at) as at from (
      select greatest(created_at, sent_at, accepted_at) as at from proposals
       where property_id = ${propertyId}
         and (${company}::text is null or company_id = ${company}::text)
      union all
      select created_at from jobs
       where property_id = ${propertyId}
         and (${company}::text is null or company_id = ${company}::text)
    ) a
  `;
  return {
    property: prop,
    open_estimates: estimates.map((e) => ({ ...e, created_at: iso(e.created_at) ?? "" })),
    recent_jobs: jobs.map((j) => ({ ...j, completed_at: iso(j.completed_at) ?? "" })),
    open_work_orders: null,
    unpaid_invoices: null,
    last_activity_at: iso(last?.at),
  };
}

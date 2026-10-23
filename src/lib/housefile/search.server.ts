/**
 * Unified search (Sprint 1 #2) over `search_documents` (migration 0058).
 *
 * Scoping is enforced in SQL, never filtered in JS (AC 2.4):
 *   - Shop: docs whose company_id is the caller's shop (owner or member) AND
 *     whose property row is the shop's own. Jobs a shop copied onto a
 *     homeowner's / PM's row stay out of the shop's results (the shop can't
 *     open that row).
 *   - Homeowner / PM: docs whose property_id is a property row the caller is
 *     entitled to (properties.homeowner_user_id, or a paid portfolio the caller
 *     owns or is a member of, joined through portfolio_properties). This is how
 *     jobs a shop copied onto the homeowner's / PM's own rows show up. It never
 *     goes through the shop's company_id, and search_documents.portfolio_id is
 *     not trusted for access.
 *
 * Rank (AC 2.2): exact record id -> property address (prefix, infix, fuzzy) ->
 * homeowner name / phone / email -> other text. Property hits at the same
 * street + zip are collapsed (like collapseSameAddress in server.ts).
 *
 * Keep this module free of "@/..." runtime imports so tests and the benchmark
 * can load it with plain Node.
 */
import type { Sql } from "../db";

export const SEARCH_TYPES = ["property", "proposal", "job", "person"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];
export type SearchDocType = "property" | "proposal" | "job";
export type SearchMatch = "id" | "address" | "person" | "text" | "recent";

export type SearchHit = {
  type: SearchDocType;
  id: string;
  property_id: string | null;
  label: string;
  sublabel: string;
  url: string;
  match: SearchMatch;
};

export type SearchViewer = {
  userId: string;
  /** Shop the caller owns or belongs to, if any. */
  companyId: string | null;
  /** Which app the result URLs should open in. */
  surface: "shop" | "home" | "manage";
};

export type SearchOptions = {
  /** Canonical street+zip key; pass addressKey from ./address-claim. */
  addressKey: (line: string, zip: string) => string;
  limit?: number;
};

const MAX_LIMIT = 20;
const RECENT_LIMIT = 10;
const MAX_QUERY = 200;
const HOUSEHOLD_COMPANY = "co_household";

const TIER: Record<number, SearchMatch> = { 0: "id", 1: "address", 2: "person", 3: "text", 9: "recent" };

export function parseSearchType(raw: string | null | undefined): SearchType | null | "invalid" {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t || t === "all") return null;
  return (SEARCH_TYPES as readonly string[]).includes(t) ? (t as SearchType) : "invalid";
}

/** Digits of a phone-looking query; null when the query has letters or too few digits. */
export function phoneDigits(q: string): string | null {
  if (/[a-z@]/i.test(q)) return null;
  let d = q.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.length >= 4 ? d : null;
}

/** Lowercased email when the query looks like one (contains @). */
export function emailQuery(q: string): string | null {
  const e = q.trim().toLowerCase();
  return e.includes("@") && !/\s/.test(e) ? e : null;
}

/** Resolve the caller's shop without side effects (unlike shopFor in server.ts). */
export async function resolveSearchViewer(sql: Sql, userId: string): Promise<SearchViewer> {
  const rows = await sql<{ id: string }>`
    select c.id from companies c
    where c.user_id = ${userId} and c.id <> ${HOUSEHOLD_COMPANY}
    union all
    select c.id from company_members m join companies c on c.id = m.company_id
    where m.user_id = ${userId} and c.id <> ${HOUSEHOLD_COMPANY}
    limit 1
  `;
  const companyId = rows[0]?.id ?? null;
  if (companyId) return { userId, companyId, surface: "shop" };
  const pm = await sql<{ one: number }>`
    select 1 as one from portfolios pf
    where pf.user_id = ${userId}
       or exists (select 1 from portfolio_members m where m.portfolio_id = pf.id and m.user_id = ${userId})
    limit 1
  `;
  return { userId, companyId: null, surface: pm[0] ? "manage" : "home" };
}

function hitUrl(surface: SearchViewer["surface"], type: SearchDocType, id: string, propertyId: string | null) {
  const pid = encodeURIComponent(propertyId ?? id);
  if (surface === "shop") {
    if (type === "proposal") return `/app/proposals/${encodeURIComponent(id)}`;
    return `/app/properties/${pid}`;
  }
  return surface === "manage" ? `/manage/${pid}` : `/home/${pid}`;
}

function zipFromAddressNorm(addressNorm: string | null) {
  const m = /(\d{5})(?:-\d{4})?\s*$/.exec(addressNorm ?? "");
  return m ? m[1] : "";
}

type Row = {
  doc_type: SearchDocType;
  ref_id: string;
  property_id: string | null;
  title: string | null;
  subtitle: string | null;
  address_norm: string | null;
  tier: number;
  score: number;
  job_count: number;
};

/**
 * Entitled-scope predicate shared by both queries. $1 = companyId (nullable),
 * $2 = userId. Written once so the two queries cannot drift apart.
 */
const SCOPE_SQL = `(
  ($1::text is not null and d.company_id = $1::text
   and exists (select 1 from properties sp
                where sp.id = d.property_id and sp.company_id = $1::text))
  or d.property_id = any (array(
    select p.id from properties p where p.homeowner_user_id = $2::text
    union
    select pp.property_id
      from portfolio_properties pp
      join portfolios pf on pf.id = pp.portfolio_id
     where pf.paid_at is not null
       and (pf.user_id = $2::text
            or exists (select 1 from portfolio_members m
                        where m.portfolio_id = pf.id and m.user_id = $2::text))
  ))
)`;

const TYPE_SQL = `($3::text is null or d.doc_type = $3::text)`;

export async function searchDocuments(
  sql: Sql,
  viewer: SearchViewer,
  rawQuery: string,
  type: SearchType | null,
  opts: SearchOptions,
): Promise<SearchHit[]> {
  const q = (rawQuery ?? "").slice(0, MAX_QUERY).trim();
  const limit = Math.min(Math.max(opts.limit ?? MAX_LIMIT, 1), MAX_LIMIT);
  const docType = type === "person" ? "property" : type;
  let rows: Row[];

  if (!q) {
    rows = await sql.query<Row>(
      `select d.doc_type, d.ref_id, d.property_id, d.title, d.subtitle, d.address_norm,
              9 as tier, 0::float8 as score, 0 as job_count
         from search_documents d
        where ${SCOPE_SQL} and ${TYPE_SQL}
        order by d.updated_at desc nulls last, d.ref_id
        limit ${RECENT_LIMIT * 3}`,
      [viewer.companyId, viewer.userId, docType],
    );
    return toHits(rows, viewer, opts, RECENT_LIMIT);
  }

  const phone = phoneDigits(q);
  const email = emailQuery(q);
  // Normalize with the same SQL function the index uses (accents, case).
  const [{ qn }] = await sql.query<{ qn: string }>(`select public.search_norm($1::text) as qn`, [q]);
  const ql = q.toLowerCase();
  const words = qn.split(/[^\p{L}\p{N}]+/u).filter(Boolean).slice(0, 8);
  const tq = words.length ? words.map((w) => `${w}:*`).join(" & ") : null;
  const tqPerson = words.length ? words.map((w) => `${w}:*B`).join(" & ") : null;
  const qlike = qn.replace(/[\\%_]/g, (c) => `\\${c}`);
  const fuzzy = qn.length >= 3;

  // Every OR arm below is backed by an index (0058 + 0060), so Postgres can
  // BitmapOr them instead of scanning the tenant. Arms are only added when
  // the query can use them; values are always bound parameters.
  // $1 company, $2 user, $3 doc type, $4 q, $5 ql, $6 qn, $7 qlike
  const params: unknown[] = [viewer.companyId, viewer.userId, docType, q, ql, qn, qlike];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  const idArm = `(d.doc_type, d.ref_id) in (('property', $4::text), ('proposal', $4::text), ('job', $4::text),
                  ('property', $5::text), ('proposal', $5::text), ('job', $5::text))`;
  const addrArm = fuzzy
    ? `(d.doc_type = 'property' and (d.address_norm like '%' || $7::text || '%' or $6::text <% d.address_norm))`
    : null;
  const phoneArm = phone ? `d.phone_norm like '%' || ${p(phone)}::text || '%'` : null;
  const emailArm = email ? `d.email_norm like ${p(email.replace(/[\\%_]/g, (c) => `\\${c}`))}::text || '%'` : null;
  const tqP = tq ? p(tq) : null;
  const tqPersonP = tqPerson ? p(tqPerson) : null;
  const textArm = tqP ? `d.tsv @@ to_tsquery('simple', ${tqP}::text)` : null;
  const titleArm = fuzzy ? `$6::text <% public.search_norm(d.title)` : null;
  const arms = [idArm, addrArm, phoneArm, emailArm, textArm, titleArm].filter(Boolean);
  const personArms = [
    phoneArm,
    emailArm,
    tqPersonP ? `d.tsv @@ to_tsquery('simple', ${tqPersonP}::text)` : null,
  ].filter(Boolean);
  const personOnly = type === "person";

  rows = await sql.query<Row>(
    `with cand as (
       select d.*,
         case
           when d.ref_id in ($4::text, $5::text) then 0
           when ${addrArm ?? "false"} then 1
           when d.doc_type = 'property' and (${personArms.join(" or ") || "false"}) then 2
           else 3
         end as tier
       from search_documents d
       where (${arms.join("\n          or ")})
         and ${SCOPE_SQL} and ${TYPE_SQL}
     )
     select c.doc_type, c.ref_id, c.property_id, c.title, c.subtitle, c.address_norm, c.tier,
            (case when c.address_norm like $7::text || '%' then 2.0 else 0 end)
              + similarity(coalesce(c.address_norm, ''), $6::text)
              ${tqP ? `+ ts_rank(c.tsv, to_tsquery('simple', ${tqP}::text))` : ""} as score,
            case when c.doc_type = 'property'
                 then (select count(*)::int from jobs j where j.property_id = c.ref_id) else 0 end as job_count
       from cand c
      ${personOnly ? "where c.tier in (0, 2) and c.doc_type = 'property'" : ""}
      order by c.tier, score desc, c.updated_at desc nulls last, c.ref_id
      limit ${MAX_LIMIT * 3}`,
    params,
  );
  return toHits(rows, viewer, opts, limit);
}

function toHits(rows: Row[], viewer: SearchViewer, opts: SearchOptions, limit: number): SearchHit[] {
  // Collapse duplicate property rows for one street + zip (one household may
  // own a copy alongside the shop's copy, or a shop quoted it twice). Keep the
  // best-ranked row; on equal tier keep the one with more filed jobs.
  const seen = new Map<string, number>();
  const out: (SearchHit & { _rank: [number, number] })[] = [];
  for (const r of rows) {
    const tier = Number(r.tier);
    const hit = {
      type: r.doc_type,
      id: r.ref_id,
      property_id: r.property_id,
      label: r.title?.trim() || (r.doc_type === "property" ? "Property" : r.doc_type === "proposal" ? "Estimate" : "Job"),
      sublabel: r.subtitle ?? "",
      url: hitUrl(viewer.surface, r.doc_type, r.ref_id, r.property_id),
      match: TIER[tier] ?? "text",
      _rank: [tier, Number(r.job_count) || 0] as [number, number],
    };
    if (r.doc_type === "property" && r.title) {
      const key = opts.addressKey(r.title, zipFromAddressNorm(r.address_norm));
      const at = seen.get(key);
      if (at !== undefined) {
        const prev = out[at];
        if (prev._rank[0] === tier && hit._rank[1] > prev._rank[1]) out[at] = hit;
        continue;
      }
      seen.set(key, out.length);
    }
    out.push(hit);
  }
  return out.slice(0, limit).map(({ _rank, ...h }) => h);
}

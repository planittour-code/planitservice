import { createServerFn } from "@tanstack/react-start";
import { authMiddleware, optionalAuthMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { applyPriceBook, assertBookPrices, catalogFor, hydrateBook, parseBookCsv, STARTER_BOOK, type PriceBookItem } from "./book";
import { FIELD_CATALOG } from "./fields";
import { num, slugToken } from "./format";
import { parseStreet, standardizeFromCensus, suggestFromPhoton, type AddressHit } from "./geocode";
import {
  ESTIMATE_KEY,
  estimatePhotos,
  estimateReady,
  parseEstimateLines,
  toQuoteLines,
} from "./estimate-lines";
import { buildQuote, factsFromTakeoff, workForTemplate, WORK_BY_ID } from "./quote";
import type {
  AddressTease,
  Company,
  CompanyMember,
  HouseCompany,
  HouseFile,
  Job,
  JobSpec,
  JobWithSpecs,
  Property,
  PropertyFact,
  PropertyListRow,
  PropertyPhoto,
  Proposal,
  ProposalBundle,
  ProposalItem,
  ProposalListRow,
  ProposalMessage,
  Template,
  TemplateItem,
  HomeownerHouse,
  HomeownerPlan,
  HomeownerProfile,
  MaintenanceTask,
  PropertyPlan,
  PropertyTransfer,
  Rfp,
  RfpQuote,
  ShopRole,
} from "./types";
import { MAINTENANCE_LIBRARY, nextDue } from "./maintain";

function asCompany(row: Company): Company {
  return {
    ...row,
    logo_src: row.logo_src ?? null,
    agreement: row.agreement ?? null,
    terms: row.terms ?? null,
    trades: row.trades ?? null,
    onboarded_at: row.onboarded_at ?? null,
  };
}

function publicCompany(c: Company): HouseCompany {
  return {
    id: c.id,
    name: c.name,
    trade: c.trade,
    phone: c.phone,
    email: c.email,
    logo_src: c.logo_src ?? null,
    agreement: c.agreement ?? null,
    terms: c.terms ?? null,
  };
}

function hydrateItem<T extends { qty: number; unit_price: number; warranty_years: number | null }>(
  row: T,
): T {
  const extra = row as T & { unit_cost?: number | null };
  return {
    ...row,
    qty: num(row.qty),
    unit_price: num(row.unit_price),
    warranty_years: row.warranty_years == null ? null : num(row.warranty_years),
    ...(extra.unit_cost !== undefined
      ? { unit_cost: extra.unit_cost == null ? null : num(extra.unit_cost) }
      : {}),
  };
}

async function shopFor(
  sql: Sql,
  userId: string,
  email?: string | null,
): Promise<{ company: Company; role: ShopRole }> {
  const owned = await sql<Company>`select * from companies where user_id = ${userId} limit 1`;
  if (owned[0]) {
    await ensureOwnerMember(sql, owned[0], email);
    await ensureStarterBook(sql, owned[0].id);
    return { company: asCompany(owned[0]), role: "owner" };
  }
  const byUser = await sql<(Company & { member_role: string })>`
    select c.*, m.role as member_role
    from company_members m
    join companies c on c.id = m.company_id
    where m.user_id = ${userId}
    limit 1
  `;
  if (byUser[0]) {
    const { member_role, ...rest } = byUser[0];
    return { company: asCompany(rest as Company), role: member_role === "owner" ? "owner" : "sales" };
  }
  const normalized = email?.trim().toLowerCase() ?? "";
  if (normalized) {
    const byEmail = await sql<(Company & { member_id: string; member_role: string })>`
      select c.*, m.id as member_id, m.role as member_role
      from company_members m
      join companies c on c.id = m.company_id
      where lower(m.email) = ${normalized}
      limit 1
    `;
    if (byEmail[0]) {
      await sql`update company_members set user_id = ${userId} where id = ${byEmail[0].member_id}`;
      const { member_id: _id, member_role, ...rest } = byEmail[0];
      return { company: asCompany(rest as Company), role: member_role === "owner" ? "owner" : "sales" };
    }
  }
  const id = crypto.randomUUID();
  const local = email?.split("@")[0]?.replace(/[._]/g, " ") ?? "My company";
  const name = local.replace(/\b\w/g, (c) => c.toUpperCase());
  await sql`
    insert into companies (id, user_id, name, trade, email)
    values (${id}, ${userId}, ${name}, ${"general"}, ${email ?? null})
  `;
  await sql`
    insert into company_members (id, company_id, user_id, email, role)
    values (${crypto.randomUUID()}, ${id}, ${userId}, ${normalized || `owner-${id}@local`}, ${"owner"})
    on conflict (company_id, email) do nothing
  `;
  await ensureStarterBook(sql, id);
  const created = await sql<Company>`select * from companies where id = ${id}`;
  return { company: created[0]!, role: "owner" };
}

async function companyFor(sql: Sql, userId: string, email?: string | null): Promise<Company> {
  return (await shopFor(sql, userId, email)).company;
}

async function ensureOwnerMember(sql: Sql, company: Company, email?: string | null) {
  const mail = (email || company.email || `owner-${company.id}@local`).trim().toLowerCase();
  await sql`
    insert into company_members (id, company_id, user_id, email, role)
    values (${crypto.randomUUID()}, ${company.id}, ${company.user_id}, ${mail}, ${"owner"})
    on conflict (company_id, email) do update set user_id = excluded.user_id, role = ${"owner"}
  `;
}

async function ensureStarterBook(sql: Sql, companyId: string) {
  const count = await sql<{ c: number }>`select count(*)::int as c from price_book where company_id = ${companyId}`;
  if (num(count[0]?.c) > 0) return;
  for (const row of STARTER_BOOK) {
    await sql`
      insert into price_book (
        id, company_id, trade, slot, manufacturer, product_name, sku, color, unit,
        cost, sell, warranty_years, warranty_terms
      ) values (
        ${crypto.randomUUID()}, ${companyId}, ${row.trade}, ${row.slot}, ${row.manufacturer},
        ${row.product_name}, ${row.sku}, ${row.color}, ${row.unit},
        ${row.cost}, ${row.sell}, ${row.warranty_years}, ${row.warranty_terms}
      )
    `;
  }
}

async function ensureDemoPending(sql: Sql, companyId: string) {
  const maple = await sql<Property>`
    select * from properties
    where company_id = ${companyId} and address_line = ${"142 Maple Street"}
    limit 1
  `;
  if (!maple[0]) return;
  const existing = await sql<{ id: string }>`
    select id from proposals where property_id = ${maple[0].id} and status = ${"pending"} limit 1
  `;
  if (existing[0]) return;
  const proposalId = crypto.randomUUID();
  await sql`
    insert into proposals (
      id, company_id, property_id, template_id, share_token, title, status, cover_note, sent_at
    ) values (
      ${proposalId}, ${companyId}, ${maple[0].id}, ${"tmpl_windows"}, ${slugToken()},
      ${"Window replacement — Marvin Essential"}, ${"pending"},
      ${"Twelve openings. Sales picked Marvin Essential. The yard cost is not in the book yet."},
      ${null}
    )
  `;
  const lines: {
    sort: number;
    name: string;
    description: string;
    qty: number;
    unit: string;
    price: number;
    cost: number | null;
    category: string;
    manufacturer: string | null;
    product: string | null;
    years: number | null;
    terms: string | null;
  }[] = [
    {
      sort: 1,
      name: "Remove and haul",
      description: "Wood divided-lite, 1998. Openings covered same day.",
      qty: 12,
      unit: "ea",
      price: 55,
      cost: null,
      category: "demo",
      manufacturer: null,
      product: null,
      years: null,
      terms: null,
    },
    {
      sort: 2,
      name: "Marvin Essential",
      description: "Unit, flashing, and install. Low-E glass. Yard cost proposed — not yet in the book.",
      qty: 12,
      unit: "ea",
      price: 672,
      cost: 480,
      category: "window",
      manufacturer: "Marvin",
      product: "Essential",
      years: 20,
      terms: "20-year glass. 10-year hardware when registered.",
    },
    {
      sort: 3,
      name: "Interior casing and stool",
      description: "New casing at each opening.",
      qty: 12,
      unit: "ea",
      price: 95,
      cost: null,
      category: "trim",
      manufacturer: null,
      product: null,
      years: null,
      terms: null,
    },
  ];
  for (const item of lines) {
    await sql`
      insert into proposal_items (
        id, proposal_id, sort_order, name, description, qty, unit, unit_price, unit_cost,
        included, optional, category, manufacturer, product_name, sku, color,
        warranty_years, warranty_terms
      ) values (
        ${crypto.randomUUID()}, ${proposalId}, ${item.sort}, ${item.name}, ${item.description},
        ${item.qty}, ${item.unit}, ${item.price}, ${item.cost},
        ${true}, ${false}, ${item.category}, ${item.manufacturer},
        ${item.product}, ${null}, ${null}, ${item.years}, ${item.terms}
      )
    `;
  }
  await sql`
    insert into proposal_messages (id, proposal_id, author_role, author_name, body)
    values (
      ${crypto.randomUUID()}, ${proposalId}, ${"contractor"}, ${"Sales"},
      ${"Quoted Marvin Essential at $480 a unit from the yard. Cost is not in the book. Margaret should not see this until you approve the number."}
    )
  `;
}

async function requireOwnedProperty(sql: Sql, companyId: string, propertyId: string) {
  const rows = await sql<Property>`
    select * from properties where id = ${propertyId} and company_id = ${companyId} limit 1
  `;
  if (!rows[0]) throw new Error("Property not found");
  return rows[0];
}

async function userIdForEmail(sql: Sql, email: string): Promise<string | null> {
  const rows = await sql<{ id: string }>`
    select id from "user" where lower(email) = ${email.trim().toLowerCase()} limit 1
  `;
  return rows[0]?.id ?? null;
}

async function bindHomeownerByEmail(sql: Sql, userId: string, email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  await sql`
    update properties
    set homeowner_user_id = ${userId},
        invite_status = ${"claimed"}
    where lower(homeowner_email) = ${normalized}
      and (homeowner_user_id is null or homeowner_user_id = ${userId})
  `;
}

async function attachHomeownerIfKnown(sql: Sql, propertyId: string, email: string) {
  const userId = await userIdForEmail(sql, email);
  if (!userId) return;
  await sql`
    update properties
    set homeowner_user_id = ${userId}
    where id = ${propertyId} and homeowner_user_id is null
  `;
}

function listRowFromCounts(p: PropertyListRow): PropertyListRow {
  return {
    ...p,
    fact_count: num(p.fact_count),
    photo_count: num(p.photo_count),
    job_count: num(p.job_count),
    open_proposal_count: num(p.open_proposal_count),
  };
}

async function loadHouse(sql: Sql, property: Property): Promise<HouseFile> {
  const companyRows = await sql<Company>`select * from companies where id = ${property.company_id}`;
  const company = companyRows[0]!;
  const facts = await sql<PropertyFact>`
    select * from property_facts where property_id = ${property.id} order by field_key
  `;
  const photos = await sql<PropertyPhoto>`
    select * from property_photos where property_id = ${property.id} order by created_at desc
  `;
  const jobs = await sql<Job>`
    select * from jobs where property_id = ${property.id} order by completed_at desc
  `;
  const specs = await sql<JobSpec>`
    select s.* from job_specs s
    join jobs j on j.id = s.job_id
    where j.property_id = ${property.id}
    order by s.label
  `;
  const specsByJob = new Map<string, JobSpec[]>();
  for (const s of specs) {
    const list = specsByJob.get(s.job_id) ?? [];
    list.push({
      ...s,
      warranty_years: s.warranty_years == null ? null : num(s.warranty_years),
    });
    specsByJob.set(s.job_id, list);
  }
  const jobsWith: JobWithSpecs[] = jobs.map((j) => ({
    ...j,
    specs: specsByJob.get(j.id) ?? [],
  }));
  const proposals = await sql<ProposalListRow>`
    select pr.*, p.address_line, p.homeowner_name,
      t.name as template_name, t.trade as template_trade
    from proposals pr
    join properties p on p.id = pr.property_id
    left join templates t on t.id = pr.template_id
    where pr.property_id = ${property.id}
    order by pr.created_at desc
  `;
  return {
    property,
    company: publicCompany(asCompany(company)),
    facts,
    photos,
    jobs: jobsWith,
    proposals,
    filledCount: facts.length,
    totalCount: FIELD_CATALOG.length,
  };
}

async function loadProposal(sql: Sql, proposal: Proposal): Promise<ProposalBundle> {
  const items = await sql<ProposalItem>`
    select * from proposal_items where proposal_id = ${proposal.id} order by sort_order
  `;
  const messages = await sql<ProposalMessage>`
    select * from proposal_messages where proposal_id = ${proposal.id} order by created_at
  `;
  const propertyRows = await sql<Property>`select * from properties where id = ${proposal.property_id}`;
  const companyRows = await sql<Company>`select * from companies where id = ${proposal.company_id}`;
  const property = propertyRows[0]!;
  const company = companyRows[0]!;
  const house = await loadHouse(sql, property);
  return {
    proposal,
    items: items.map((i) => hydrateItem({ ...i, included: Boolean(i.included), optional: Boolean(i.optional) })),
    messages,
    property,
    company: publicCompany(asCompany(company)),
    house,
  };
}

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const { company, role } = await shopFor(sql, context.userId, session?.email);
    await ensureDemoPending(sql, company.id);
    const properties = await sql<PropertyListRow>`
      select p.*,
        (select count(*)::int from property_facts f where f.property_id = p.id) as fact_count,
        (select count(*)::int from property_photos ph where ph.property_id = p.id) as photo_count,
        (select count(*)::int from jobs j where j.property_id = p.id) as job_count,
        (select count(*)::int from proposals pr where pr.property_id = p.id and pr.status in ('draft','pending','sent','revised','accepted')) as open_proposal_count,
        (select ph.src from property_photos ph where ph.property_id = p.id order by case when ph.category = 'exterior' then 0 else 1 end, ph.created_at desc limit 1) as cover_src
      from properties p
      where p.company_id = ${company.id}
      order by p.created_at desc
    `;
    const proposals = await sql<ProposalListRow>`
      select pr.*, p.address_line, p.homeowner_name
      from proposals pr
      join properties p on p.id = pr.property_id
      where pr.company_id = ${company.id}
      order by pr.created_at desc
      limit 12
    `;
    const templates = await sql<{ c: number }>`select count(*)::int as c from templates where company_id is null`;
    const pending = await sql<ProposalListRow>`
      select pr.*, p.address_line, p.homeowner_name
      from proposals pr
      join properties p on p.id = pr.property_id
      where pr.company_id = ${company.id} and pr.status = ${"pending"}
      order by pr.created_at desc
    `;
    return {
      company,
      role,
      pending,
      properties: properties.map((p) => ({
        ...p,
        fact_count: num(p.fact_count),
        photo_count: num(p.photo_count),
        job_count: num(p.job_count),
        open_proposal_count: num(p.open_proposal_count),
      })),
      proposals,
      templateCount: num(templates[0]?.c),
    };
  });

export const updateCompany = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      name: string;
      trade: string;
      phone: string;
      email: string;
      logo_src?: string | null;
      agreement?: string | null;
      terms?: string | null;
      trades?: string | null;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const company = await companyFor(sql, context.userId, session?.email);
    const name = data.name.trim() || company.name;
    await sql`
      update companies
      set name = ${name},
          trade = ${data.trade.trim() || "general"},
          phone = ${data.phone.trim() || null},
          email = ${data.email.trim() || company.email},
          logo_src = ${data.logo_src === undefined ? company.logo_src : data.logo_src},
          agreement = ${data.agreement === undefined ? company.agreement : data.agreement},
          terms = ${data.terms === undefined ? company.terms : data.terms},
          trades = ${data.trades === undefined ? company.trades : data.trades}
      where id = ${company.id}
    `;
    const rows = await sql<Company>`select * from companies where id = ${company.id}`;
    return asCompany(rows[0]!);
  });

export const completeOnboard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      name: string;
      trades: string[];
      book: "homedepot" | "lowes" | "starter";
      logo?: string;
      agreement: string;
      terms: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const { company, role } = await shopFor(sql, context.userId, session?.email);
    if (role !== "owner") throw new Error("Only the owner sets up the shop.");
    const trades = data.trades.filter(Boolean);
    if (trades.length === 0) throw new Error("Pick at least one service.");
    const tradeLabel = trades.join(", ");
    await sql`
      update companies
      set name = ${data.name.trim() || company.name},
          trade = ${tradeLabel},
          trades = ${trades.join(",")},
          logo_src = ${data.logo?.trim() || company.logo_src},
          agreement = ${data.agreement.trim() || null},
          terms = ${data.terms.trim() || null},
          onboarded_at = ${new Date().toISOString()}
      where id = ${company.id}
    `;
    await sql`update price_book set active = false, updated_at = now() where company_id = ${company.id}`;
    const allowed = new Set(trades.map((id) => WORK_BY_ID[id]?.trade).filter(Boolean));
    const rows = catalogFor(data.book).filter((r) => allowed.has(r.trade));
    for (const row of rows.length ? rows : catalogFor(data.book)) {
      assertBookPrices(row);
      await sql`
        insert into price_book (
          id, company_id, trade, slot, manufacturer, product_name, sku, color, unit,
          cost, sell, warranty_years, warranty_terms, active
        ) values (
          ${crypto.randomUUID()}, ${company.id}, ${row.trade}, ${row.slot}, ${row.manufacturer},
          ${row.product_name}, ${row.sku}, ${row.color}, ${row.unit},
          ${row.cost}, ${row.sell}, ${row.warranty_years}, ${row.warranty_terms}, ${true}
        )
      `;
    }
    return { ok: true as const };
  });

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const templates = await sql<Template>`
      select id, company_id, name, trade, description, cover_note
      from templates
      where company_id is null
      order by name
    `;
    const items = await sql<TemplateItem>`
      select * from template_items
      where template_id in (select id from templates where company_id is null)
      order by sort_order
    `;
    const by = new Map<string, TemplateItem[]>();
    for (const item of items) {
      const list = by.get(item.template_id) ?? [];
      list.push(hydrateItem({ ...item, optional: Boolean(item.optional) }));
      by.set(item.template_id, list);
    }
    return templates.map((t) => ({ ...t, items: by.get(t.id) ?? [] }));
  });

export type WizardInput = {
  propertyId?: string;
  homeownerName: string;
  homeownerEmail: string;
  homeownerPhone?: string;
  addressLine: string;
  city: string;
  state: string;
  zip: string;
  templateId: string;
  title?: string;
  takeoff?: Record<string, string>;
  coverPhoto?: string;
  rfpToken?: string;
};

export const getQuoteHouse = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((propertyId: string) => propertyId)
  .handler(async ({ context, data: propertyId }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const company = await companyFor(sql, context.userId, session?.email);
    const property = await requireOwnedProperty(sql, company.id, propertyId);
    const facts = await sql<PropertyFact>`
      select * from property_facts where property_id = ${property.id}
    `;
    return {
      property,
      facts: Object.fromEntries(facts.map((f) => [f.field_key, f.value])),
    };
  });

async function writeFacts(
  sql: Sql,
  propertyId: string,
  facts: { fieldKey: string; value: string }[],
) {
  for (const fact of facts) {
    if (!FIELD_CATALOG.some((f) => f.key === fact.fieldKey)) continue;
    const value = fact.value.trim();
    if (!value) continue;
    await sql`
      insert into property_facts (id, property_id, field_key, value, source)
      values (${crypto.randomUUID()}, ${propertyId}, ${fact.fieldKey}, ${value}, ${"contractor"})
      on conflict (property_id, field_key)
      do update set value = excluded.value, source = excluded.source, updated_at = now()
    `;
  }
}

async function writeProposedCostsToBook(
  sql: Sql,
  companyId: string,
  lines: { bookId?: string; unit_cost?: number | null }[],
  takeoff: Record<string, string>,
) {
  for (const line of lines) {
    if (!line.bookId) continue;
    const raw = takeoff[`cost_${line.bookId}`];
    const cost = raw != null && String(raw).trim() !== "" ? num(raw) : line.unit_cost;
    if (cost == null) continue;
    await sql`
      update price_book
      set cost = ${cost},
          sell = coalesce(sell, ${cost * 1.4}),
          updated_at = now()
      where id = ${line.bookId} and company_id = ${companyId} and cost is null
    `;
  }
}

export const createProposalFromWizard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: WizardInput) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const { company, role } = await shopFor(sql, context.userId, session?.email);

    const templates = await sql<Template>`select * from templates where id = ${data.templateId} limit 1`;
    const template = templates[0];
    if (!template) throw new Error("Template not found");
    const tItems = await sql<TemplateItem>`
      select * from template_items where template_id = ${template.id} order by sort_order
    `;
    const takeoff = data.takeoff ?? {};
    const work = workForTemplate(template.id);
    const bookRows = await sql<PriceBookItem>`
      select * from price_book where company_id = ${company.id} and active = true
    `;
    const book = bookRows.map(hydrateBook);
    const estimate = parseEstimateLines(takeoff[ESTIMATE_KEY]);
    const priced = estimateReady(estimate)
      ? toQuoteLines(estimate, book)
      : work
        ? applyPriceBook(buildQuote(work.id, takeoff), book, takeoff)
        : [];
    const catalogMissing = priced.filter((l) => {
      if (!l.bookId || !l.included) return false;
      const item = book.find((b) => b.id === l.bookId);
      return Boolean(item && item.cost == null);
    });
    if (
      !estimateReady(estimate) &&
      catalogMissing.some((l) => !String(takeoff[`cost_${l.bookId}`] ?? "").trim())
    ) {
      throw new Error("Enter a cost for each product that does not have one.");
    }

    let property: Property;
    if (data.propertyId) {
      property = await requireOwnedProperty(sql, company.id, data.propertyId);
    } else {
      const address = data.addressLine.trim();
      const name = data.homeownerName.trim();
      const email = data.homeownerEmail.trim().toLowerCase();
      if (!address || !name || !email) throw new Error("Name, email, and address are required");
      const id = crypto.randomUUID();
      await sql`
        insert into properties (
          id, company_id, share_token, invite_token, invite_status,
          address_line, city, state, zip, homeowner_name, homeowner_email, homeowner_phone
        ) values (
          ${id}, ${company.id}, ${slugToken()}, ${slugToken()}, ${"sent"},
          ${address}, ${data.city.trim() || "—"}, ${data.state.trim() || "—"}, ${data.zip.trim() || "—"},
          ${name}, ${email}, ${data.homeownerPhone?.trim() || null}
        )
      `;
      property = (await sql<Property>`select * from properties where id = ${id}`)[0]!;
    }

    const proposalId = crypto.randomUUID();
    const title = data.title?.trim() || template.name;
    const pending = role === "sales" && catalogMissing.length > 0;
    await sql`
      insert into proposals (
        id, company_id, property_id, template_id, share_token, title, status, cover_note, sent_at, created_by
      ) values (
        ${proposalId}, ${company.id}, ${property.id}, ${template.id}, ${slugToken()},
        ${title}, ${pending ? "pending" : "sent"}, ${company.agreement?.trim() || template.cover_note},
        ${pending ? null : new Date().toISOString()}, ${context.userId}
      )
    `;
    const itemsToWrite =
      priced.length > 0
        ? priced.map((item, i) => ({
            sort_order: i + 1,
            name: item.name,
            description: item.description,
            qty: item.qty,
            unit: item.unit,
            unit_price: item.unit_price,
            unit_cost: item.unit_cost ?? null,
            included: item.included,
            optional: item.optional,
            category: item.category,
            manufacturer: item.manufacturer,
            product_name: item.product_name,
            sku: item.sku,
            color: item.color,
            warranty_years: item.warranty_years,
            warranty_terms: item.warranty_terms,
            option_id: item.optionId ?? null,
          }))
        : tItems.map((item) => ({
            sort_order: item.sort_order,
            name: item.name,
            description: item.description,
            qty: num(item.qty),
            unit: item.unit,
            unit_price: num(item.unit_price),
            unit_cost: null as number | null,
            included: true,
            optional: Boolean(item.optional),
            category: item.category,
            manufacturer: item.manufacturer,
            product_name: item.product_name,
            sku: item.sku,
            color: item.color,
            warranty_years: item.warranty_years,
            warranty_terms: item.warranty_terms,
            option_id: null,
          }));
    for (const item of itemsToWrite) {
      await sql`
        insert into proposal_items (
          id, proposal_id, sort_order, name, description, qty, unit, unit_price, unit_cost,
          included, optional, category, manufacturer, product_name, sku, color,
          warranty_years, warranty_terms, option_id
        ) values (
          ${crypto.randomUUID()}, ${proposalId}, ${item.sort_order}, ${item.name}, ${item.description},
          ${item.qty}, ${item.unit}, ${item.unit_price}, ${item.unit_cost},
          ${item.included}, ${item.optional}, ${item.category}, ${item.manufacturer},
          ${item.product_name}, ${item.sku}, ${item.color}, ${item.warranty_years}, ${item.warranty_terms},
          ${item.option_id}
        )
      `;
    }
    if (work) {
      await writeFacts(sql, property.id, factsFromTakeoff(work, takeoff));
    }
    const cover = data.coverPhoto?.trim() ?? "";
    if (cover && (cover.startsWith("data:image/") || cover.startsWith("/"))) {
      await sql`
        insert into property_photos (id, property_id, src, caption, category, uploaded_by)
        values (
          ${crypto.randomUUID()}, ${property.id}, ${cover},
          ${"Job photo"}, ${"exterior"}, ${"contractor"}
        )
      `;
    }

    for (const photo of estimatePhotos(estimate)) {
      await sql`
        insert into property_photos (id, property_id, src, caption, category, uploaded_by)
        values (
          ${crypto.randomUUID()}, ${property.id}, ${photo.src},
          ${photo.caption}, ${"job"}, ${"contractor"}
        )
      `;
    }

    if (role === "owner") {
      await writeProposedCostsToBook(sql, company.id, priced, takeoff);
    }
    await sql`
      insert into proposal_messages (id, proposal_id, author_role, author_name, body)
      values (
        ${crypto.randomUUID()}, ${proposalId}, ${"contractor"}, ${company.name},
        ${`First draft for ${property.address_line}. Please review, add photos, and note anything we missed.`}
      )
    `;
    if (!pending) {
      await sql`update properties set invite_status = ${"sent"} where id = ${property.id}`;
    }
    await attachHomeownerIfKnown(sql, property.id, property.homeowner_email);
    if (data.rfpToken) {
      await attachRfpQuote(sql, data.rfpToken, company.id, proposalId, property);
    }
    const proposal = (await sql<Proposal>`select * from proposals where id = ${proposalId}`)[0]!;
    return {
      propertyId: property.id,
      proposalId: proposal.id,
      houseToken: property.share_token,
      inviteToken: property.invite_token,
      proposalToken: proposal.share_token,
      homeownerEmail: property.homeowner_email,
      homeownerName: property.homeowner_name,
      address: `${property.address_line}, ${property.city}, ${property.state} ${property.zip}`,
      companyName: company.name,
      pending,
    };
  });

export const getContractorProperty = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const company = await companyFor(sql, context.userId, session?.email);
    const property = await requireOwnedProperty(sql, company.id, id);
    return loadHouse(sql, property);
  });

export const getContractorProposal = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const company = await companyFor(sql, context.userId, session?.email);
    const rows = await sql<Proposal>`
      select * from proposals where id = ${id} and company_id = ${company.id} limit 1
    `;
    if (!rows[0]) throw new Error("Proposal not found");
    return loadProposal(sql, rows[0]);
  });

export const updateProposalMeta = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; title: string; coverNote: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const company = await companyFor(sql, context.userId, session?.email);
    await sql`
      update proposals set title = ${data.title.trim()}, cover_note = ${data.coverNote}
      where id = ${data.id} and company_id = ${company.id}
    `;
    return { ok: true as const };
  });

export const upsertProposalItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      proposalId: string;
      itemId?: string;
      name: string;
      description: string;
      qty: number;
      unit: string;
      unitPrice: number;
      optional: boolean;
      manufacturer: string;
      productName: string;
      color: string;
      warrantyYears: number | null;
      warrantyTerms: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const company = await companyFor(sql, context.userId, session?.email);
    const owned = await sql<{ id: string }>`
      select id from proposals where id = ${data.proposalId} and company_id = ${company.id}
    `;
    if (!owned[0]) throw new Error("Proposal not found");
    if (data.itemId) {
      await sql`
        update proposal_items set
          name = ${data.name.trim()},
          description = ${data.description.trim() || null},
          qty = ${num(data.qty)},
          unit = ${data.unit.trim() || "ls"},
          unit_price = ${num(data.unitPrice)},
          optional = ${data.optional},
          manufacturer = ${data.manufacturer.trim() || null},
          product_name = ${data.productName.trim() || null},
          color = ${data.color.trim() || null},
          warranty_years = ${data.warrantyYears},
          warranty_terms = ${data.warrantyTerms.trim() || null}
        where id = ${data.itemId} and proposal_id = ${data.proposalId}
      `;
      return { id: data.itemId };
    }
    const max = await sql<{ m: number }>`
      select coalesce(max(sort_order), 0)::int as m from proposal_items where proposal_id = ${data.proposalId}
    `;
    const id = crypto.randomUUID();
    await sql`
      insert into proposal_items (
        id, proposal_id, sort_order, name, description, qty, unit, unit_price,
        included, optional, manufacturer, product_name, color, warranty_years, warranty_terms
      ) values (
        ${id}, ${data.proposalId}, ${num(max[0]?.m) + 1}, ${data.name.trim()},
        ${data.description.trim() || null}, ${num(data.qty)}, ${data.unit.trim() || "ls"},
        ${num(data.unitPrice)}, ${true}, ${data.optional},
        ${data.manufacturer.trim() || null}, ${data.productName.trim() || null},
        ${data.color.trim() || null}, ${data.warrantyYears}, ${data.warrantyTerms.trim() || null}
      )
    `;
    return { id };
  });

export const addContractorMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { proposalId: string; body: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const company = await companyFor(sql, context.userId, session?.email);
    const owned = await sql<{ id: string }>`
      select id from proposals where id = ${data.proposalId} and company_id = ${company.id}
    `;
    if (!owned[0]) throw new Error("Proposal not found");
    const body = data.body.trim();
    if (!body) throw new Error("Write a note first");
    await sql`
      insert into proposal_messages (id, proposal_id, author_role, author_name, body)
      values (${crypto.randomUUID()}, ${data.proposalId}, ${"contractor"}, ${company.name}, ${body})
    `;
    return { ok: true as const };
  });

export const completeProposal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { proposalId: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const company = await companyFor(sql, context.userId, session?.email);
    const rows = await sql<Proposal>`
      select * from proposals where id = ${data.proposalId} and company_id = ${company.id} limit 1
    `;
    const proposal = rows[0];
    if (!proposal) throw new Error("Proposal not found");
    const items = await sql<ProposalItem>`
      select * from proposal_items where proposal_id = ${proposal.id} and included = true order by sort_order
    `;
    const jobId = crypto.randomUUID();
    const summary = items
      .slice(0, 4)
      .map((i) => i.name)
      .join(". ");
    await sql`
      insert into jobs (id, company_id, property_id, proposal_id, title, summary, completed_at)
      values (${jobId}, ${company.id}, ${proposal.property_id}, ${proposal.id}, ${proposal.title}, ${summary}, (now())::date)
    `;
    for (const item of items) {
      const kind =
        item.color ? "paint_color" : item.manufacturer ? "product" : "note";
      const years = item.warranty_years == null ? null : num(item.warranty_years);
      let expires: string | null = null;
      if (years && years > 0) {
        const d = new Date();
        d.setFullYear(d.getFullYear() + years);
        expires = d.toISOString().slice(0, 10);
      }
      await sql`
        insert into job_specs (
          id, job_id, kind, label, value, location_note, manufacturer, product_name,
          warranty_years, warranty_terms, warranty_expires
        ) values (
          ${crypto.randomUUID()}, ${jobId}, ${kind}, ${item.name},
          ${item.color || item.product_name || item.name},
          ${item.location_note}, ${item.manufacturer}, ${item.product_name},
          ${years}, ${item.warranty_terms}, ${expires}
        )
      `;
      if (item.color && kind === "paint_color") {
        const key =
          /door/i.test(item.name) ? "front_door_paint"
          : /trim/i.test(item.name) ? ( /interior/i.test(item.name) ? "interior_trim_paint" : "exterior_trim_paint")
          : /body|clapboard|siding|wall/i.test(item.name)
            ? (/interior|room|hall|living|dining/i.test(item.name) ? "interior_paint_main" : "exterior_paint")
            : null;
        if (key) {
          const value = [item.sku, item.color, item.manufacturer, item.product_name]
            .filter(Boolean)
            .join(" · ");
          await sql`
            insert into property_facts (id, property_id, field_key, value, source)
            values (${crypto.randomUUID()}, ${proposal.property_id}, ${key}, ${value}, ${"contractor"})
            on conflict (property_id, field_key)
            do update set value = excluded.value, source = excluded.source, updated_at = now()
          `;
        }
      }
    }
    await sql`update proposals set status = ${"completed"} where id = ${proposal.id}`;
    return { jobId };
  });

export const upsertFactContractor = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { propertyId: string; fieldKey: string; value: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const company = await companyFor(sql, context.userId, session?.email);
    await requireOwnedProperty(sql, company.id, data.propertyId);
    const value = data.value.trim();
    if (!value) {
      await sql`delete from property_facts where property_id = ${data.propertyId} and field_key = ${data.fieldKey}`;
      return { ok: true as const };
    }
    await sql`
      insert into property_facts (id, property_id, field_key, value, source)
      values (${crypto.randomUUID()}, ${data.propertyId}, ${data.fieldKey}, ${value}, ${"contractor"})
      on conflict (property_id, field_key)
      do update set value = excluded.value, source = excluded.source, updated_at = now()
    `;
    return { ok: true as const };
  });

export const addPhotoContractor = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: { propertyId: string; src: string; caption: string; category: string }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const company = await companyFor(sql, context.userId, session?.email);
    await requireOwnedProperty(sql, company.id, data.propertyId);
    if (!data.src.startsWith("data:image/") && !data.src.startsWith("/")) {
      throw new Error("Invalid photo");
    }
    const count = await sql<{ c: number }>`
      select count(*)::int as c from property_photos where property_id = ${data.propertyId}
    `;
    if (num(count[0]?.c) >= 12) throw new Error("This house file already has 12 photos");
    await sql`
      insert into property_photos (id, property_id, src, caption, category, uploaded_by)
      values (
        ${crypto.randomUUID()}, ${data.propertyId}, ${data.src},
        ${data.caption.trim() || null}, ${data.category || "general"}, ${"contractor"}
      )
    `;
    return { ok: true as const };
  });

export const suggestAddresses = createServerFn({ method: "GET" })
  .validator((query: string) => query)
  .handler(async ({ data }): Promise<AddressHit[]> => {
    const q = data.trim().slice(0, 80);
    if (q.length < 4) return [];
    try {
      return await suggestFromPhoton(q);
    } catch {
      return [];
    }
  });

export const standardizeAddress = createServerFn({ method: "GET" })
  .validator((query: string) => query)
  .handler(async ({ data }): Promise<AddressHit> => {
    return standardizeFromCensus(data);
  });

export const peekHouseByAddress = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator((query: string) => query)
  .handler(async ({ data: query, context }): Promise<AddressTease> => {
    const q = query.trim().slice(0, 80);
    if (q.length < 3) {
      return emptyTease(q);
    }
    const std = await standardizeFromCensus(q);
    const sql = await getSql();
    const like = `%${q.toLowerCase()}%`;
    const likeStd = `%${std.address.toLowerCase()}%`;
    const rows = await sql<Property>`
      select * from properties
      where lower(address_line) like ${like}
         or lower(address_line) like ${likeStd}
         or lower(city) like ${like}
         or lower(address_line || ' ' || city || ' ' || state || ' ' || zip) like ${like}
         or lower(address_line || ' ' || city || ' ' || state || ' ' || zip) like ${"%" + std.line.toLowerCase() + "%"}
      order by created_at
      limit 1
    `;
    const property = rows[0];
    if (!property) {
      const tease = emptyTease(std.line, std);
      await writeLead(sql, {
        query: q,
        address: tease.address,
        city: tease.city,
        state: tease.state,
        zip: tease.zip,
        workId: null,
        found: false,
      });
      return tease;
    }

    const factRows = await sql<PropertyFact>`
      select * from property_facts where property_id = ${property.id}
    `;
    const byKey = Object.fromEntries(factRows.map((f) => [f.field_key, f.value]));
    const teaseKeys = ["year_built", "square_feet", "stories"];
    const facts = teaseKeys
      .map((key) => {
        const def = FIELD_CATALOG.find((f) => f.key === key);
        const value = byKey[key];
        if (!def || !value) return null;
        return { key, label: def.label, value };
      })
      .filter((f): f is { key: string; label: string; value: string } => Boolean(f));

    const jobRows = await sql<Job>`
      select * from jobs where property_id = ${property.id} order by completed_at desc limit 3
    `;
    const photos = await sql<PropertyPhoto>`
      select * from property_photos
      where property_id = ${property.id}
      order by case when category = ${"exterior"} then 0 else 1 end, created_at
      limit 1
    `;

    let owned = false;
    if (context.userId) {
      const email = context.email?.trim().toLowerCase() ?? "";
      const asOwner = await sql<{ id: string }>`
        select id from companies where id = ${property.company_id} and user_id = ${context.userId} limit 1
      `;
      const asSeat = email
        ? await sql<{ id: string }>`
            select id from company_members
            where company_id = ${property.company_id}
              and (user_id = ${context.userId} or lower(email) = ${email})
            limit 1
          `
        : await sql<{ id: string }>`
            select id from company_members
            where company_id = ${property.company_id} and user_id = ${context.userId}
            limit 1
          `;
      owned = Boolean(asOwner[0] || asSeat[0]);
    }

    if (!owned) {
      await writeLead(sql, {
        query: q,
        address: property.address_line,
        city: property.city,
        state: property.state,
        zip: property.zip,
        workId: null,
        found: true,
      });
    }

    return {
      found: true,
      owned,
      propertyId: owned ? property.id : null,
      address: property.address_line,
      city: property.city,
      state: property.state,
      zip: property.zip,
      lat: std.lat ?? null,
      lng: std.lng ?? null,
      photo: photos[0]?.src ?? null,
      facts,
      jobs: jobRows.map((j) => ({
        title: j.title,
        year: String(new Date(j.completed_at).getFullYear()),
      })),
      factCount: factRows.filter((f) => String(f.value ?? "").trim()).length,
      totalCount: FIELD_CATALOG.length,
    };
  });

function emptyTease(query: string, hit?: AddressHit): AddressTease {
  const parsed = hit ?? parseStreet(query);
  return {
    found: false,
    owned: false,
    propertyId: null,
    address: parsed.address || query,
    city: parsed.city,
    state: parsed.state,
    zip: parsed.zip,
    lat: parsed.lat ?? null,
    lng: parsed.lng ?? null,
    photo: null,
    facts: [],
    jobs: [],
    factCount: 0,
    totalCount: FIELD_CATALOG.length,
  };
}

async function writeLead(
  sql: Sql,
  lead: {
    query: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    workId: string | null;
    found: boolean;
  },
) {
  const address = lead.address.trim().slice(0, 120);
  if (address.length < 3) return;
  await sql`
    insert into quote_leads (id, query, address, city, state, zip, work_id, found)
    values (
      ${crypto.randomUUID()},
      ${lead.query.trim().slice(0, 80)},
      ${address},
      ${lead.city.trim().slice(0, 80)},
      ${lead.state.trim().slice(0, 8)},
      ${lead.zip.trim().slice(0, 12)},
      ${lead.workId},
      ${lead.found}
    )
  `;
}

export type QuoteLead = {
  id: string;
  query: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  work_id: string | null;
  found: boolean;
  created_at: string;
};

export const captureQuoteLead = createServerFn({ method: "POST" })
  .validator((input: {
    address: string;
    city?: string;
    state?: string;
    zip?: string;
    workId: string;
    found?: boolean;
  }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await writeLead(sql, {
      query: data.address,
      address: data.address,
      city: data.city ?? "",
      state: data.state ?? "",
      zip: data.zip ?? "",
      workId: data.workId,
      found: Boolean(data.found),
    });
    return { ok: true as const };
  });

export const listQuoteLeads = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const { role } = await shopFor(sql, context.userId, session?.email);
    if (role !== "owner") throw new Error("Only the owner can read inbound leads.");
    const rows = await sql<QuoteLead>`
      select * from quote_leads order by created_at desc limit 100
    `;
    return { leads: rows };
  });

export const getHouseByToken = createServerFn({ method: "GET" })
  .validator((token: string) => token)
  .handler(async ({ data: token }) => {
    const sql = await getSql();
    const rows = await sql<Property>`
      select * from properties where share_token = ${token} or invite_token = ${token} limit 1
    `;
    if (!rows[0]) throw new Error("House file not found");
    if (token === rows[0].invite_token && rows[0].invite_status !== "claimed") {
      await sql`update properties set invite_status = ${"claimed"} where id = ${rows[0].id}`;
      rows[0].invite_status = "claimed";
    }
    const house = await loadHouse(sql, rows[0]);
    return {
      ...house,
      proposals: house.proposals.filter((pr) => pr.status !== "pending" && pr.status !== "draft"),
    };
  });

export const getProposalByToken = createServerFn({ method: "GET" })
  .validator((token: string) => token)
  .handler(async ({ data: token }) => {
    const sql = await getSql();
    const rows = await sql<Proposal>`select * from proposals where share_token = ${token} limit 1`;
    if (!rows[0]) throw new Error("Proposal not found");
    if (rows[0].status === "pending") throw new Error("This quote is waiting on the shop.");
    return loadProposal(sql, rows[0]);
  });

export const upsertFactPublic = createServerFn({ method: "POST" })
  .validator((input: { token: string; fieldKey: string; value: string }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<Property>`
      select * from properties where share_token = ${data.token} or invite_token = ${data.token} limit 1
    `;
    if (!rows[0]) throw new Error("House file not found");
    const value = data.value.trim();
    if (!FIELD_CATALOG.some((f) => f.key === data.fieldKey)) throw new Error("Unknown field");
    if (!value) {
      await sql`delete from property_facts where property_id = ${rows[0].id} and field_key = ${data.fieldKey}`;
      return { ok: true as const };
    }
    await sql`
      insert into property_facts (id, property_id, field_key, value, source)
      values (${crypto.randomUUID()}, ${rows[0].id}, ${data.fieldKey}, ${value}, ${"homeowner"})
      on conflict (property_id, field_key)
      do update set value = excluded.value, source = excluded.source, updated_at = now()
    `;
    return { ok: true as const };
  });

export const addPhotoPublic = createServerFn({ method: "POST" })
  .validator(
    (input: { token: string; src: string; caption: string; category: string }) => input,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<Property>`
      select * from properties where share_token = ${data.token} or invite_token = ${data.token} limit 1
    `;
    if (!rows[0]) throw new Error("House file not found");
    if (!data.src.startsWith("data:image/")) throw new Error("Invalid photo");
    const count = await sql<{ c: number }>`
      select count(*)::int as c from property_photos where property_id = ${rows[0].id}
    `;
    if (num(count[0]?.c) >= 12) throw new Error("This house file already has 12 photos");
    await sql`
      insert into property_photos (id, property_id, src, caption, category, uploaded_by)
      values (
        ${crypto.randomUUID()}, ${rows[0].id}, ${data.src},
        ${data.caption.trim() || null}, ${data.category || "general"}, ${"homeowner"}
      )
    `;
    return { ok: true as const };
  });

export const reviseProposalPublic = createServerFn({ method: "POST" })
  .validator(
    (input: {
      token: string;
      itemId: string;
      included?: boolean;
      homeownerNote?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<Proposal>`select * from proposals where share_token = ${data.token} limit 1`;
    if (!rows[0]) throw new Error("Proposal not found");
    const items = await sql<ProposalItem>`
      select * from proposal_items where id = ${data.itemId} and proposal_id = ${rows[0].id}
    `;
    if (!items[0]) throw new Error("Line not found");
    const included =
      items[0].optional && typeof data.included === "boolean" ? data.included : items[0].included;
    const note =
      data.homeownerNote !== undefined ? data.homeownerNote.trim() || null : items[0].homeowner_note;
    await sql`
      update proposal_items
      set included = ${Boolean(included)}, homeowner_note = ${note}
      where id = ${data.itemId}
    `;
    if (rows[0].status === "sent") {
      await sql`update proposals set status = ${"revised"} where id = ${rows[0].id}`;
    }
    return { ok: true as const };
  });

export const addHomeownerMessage = createServerFn({ method: "POST" })
  .validator((input: { token: string; body: string }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<Proposal>`select * from proposals where share_token = ${data.token} limit 1`;
    if (!rows[0]) throw new Error("Proposal not found");
    const property = (await sql<Property>`select * from properties where id = ${rows[0].property_id}`)[0]!;
    const body = data.body.trim();
    if (!body) throw new Error("Write a note first");
    await sql`
      insert into proposal_messages (id, proposal_id, author_role, author_name, body)
      values (${crypto.randomUUID()}, ${rows[0].id}, ${"homeowner"}, ${property.homeowner_name}, ${body})
    `;
    if (rows[0].status === "sent") {
      await sql`update proposals set status = ${"revised"} where id = ${rows[0].id}`;
    }
    return { ok: true as const };
  });

export const acceptProposalPublic = createServerFn({ method: "POST" })
  .validator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<Proposal>`select * from proposals where share_token = ${data.token} limit 1`;
    if (!rows[0]) throw new Error("Proposal not found");
    await sql`
      update proposals set status = ${"accepted"}, accepted_at = now()
      where id = ${rows[0].id}
    `;
    return { ok: true as const };
  });

export const draftCoverNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { templateName: string; address: string; homeownerName: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "AI is not available" };
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 220,
        messages: [
          {
            role: "system",
            content:
              "Write a short, calm contractor cover note for a homeowner. No hype, no emoji, no exclamation marks. 80-120 words. Name the work and invite them to revise colors, photos, and house facts.",
          },
          {
            role: "user",
            content: `Template: ${data.templateName}\nAddress: ${data.address}\nHomeowner: ${data.homeownerName}`,
          },
        ],
      }),
    });
    if (!res.ok) return { ok: false as const, error: `xAI API error ${res.status}` };
    const body = (await res.json()) as { choices: { message: { content: string } }[] };
    return { ok: true as const, text: body.choices[0]?.message.content ?? "" };
  });

async function cloneProperty(sql: Sql, source: Property, companyId: string): Promise<Property> {
  const id = crypto.randomUUID();
  await sql`
    insert into properties (
      id, company_id, share_token, invite_token, invite_status,
      address_line, city, state, zip, homeowner_name, homeowner_email, homeowner_phone, notes
    ) values (
      ${id}, ${companyId}, ${slugToken()}, ${slugToken()}, ${"claimed"},
      ${source.address_line}, ${source.city}, ${source.state}, ${source.zip},
      ${source.homeowner_name}, ${source.homeowner_email}, ${source.homeowner_phone}, ${source.notes}
    )
  `;

  const facts = await sql<PropertyFact>`select * from property_facts where property_id = ${source.id}`;
  for (const f of facts) {
    await sql`
      insert into property_facts (id, property_id, field_key, value, source)
      values (${crypto.randomUUID()}, ${id}, ${f.field_key}, ${f.value}, ${f.source})
    `;
  }

  const photos = await sql<PropertyPhoto>`select * from property_photos where property_id = ${source.id}`;
  for (const p of photos) {
    await sql`
      insert into property_photos (id, property_id, src, caption, category, uploaded_by)
      values (${crypto.randomUUID()}, ${id}, ${p.src}, ${p.caption}, ${p.category}, ${p.uploaded_by})
    `;
  }

  const jobs = await sql<Job>`select * from jobs where property_id = ${source.id} order by completed_at`;
  const jobMap = new Map<string, string>();
  for (const job of jobs) {
    const newJobId = crypto.randomUUID();
    jobMap.set(job.id, newJobId);
    await sql`
      insert into jobs (id, company_id, property_id, proposal_id, title, summary, completed_at)
      values (${newJobId}, ${companyId}, ${id}, ${null}, ${job.title}, ${job.summary}, ${job.completed_at})
    `;
  }
  if (jobMap.size > 0) {
    const specs = await sql<JobSpec>`
      select s.* from job_specs s
      join jobs j on j.id = s.job_id
      where j.property_id = ${source.id}
    `;
    for (const spec of specs) {
      const newJobId = jobMap.get(spec.job_id);
      if (!newJobId) continue;
      await sql`
        insert into job_specs (
          id, job_id, kind, label, value, location_note, manufacturer, product_name,
          warranty_years, warranty_terms, warranty_expires
        ) values (
          ${crypto.randomUUID()}, ${newJobId}, ${spec.kind}, ${spec.label}, ${spec.value},
          ${spec.location_note}, ${spec.manufacturer}, ${spec.product_name},
          ${spec.warranty_years}, ${spec.warranty_terms}, ${spec.warranty_expires}
        )
      `;
    }
  }

  const proposals = await sql<Proposal>`select * from proposals where property_id = ${source.id}`;
  for (const pr of proposals) {
    const newPrId = crypto.randomUUID();
    await sql`
      insert into proposals (
        id, company_id, property_id, template_id, share_token, title, status, cover_note, sent_at, accepted_at, created_by
      ) values (
        ${newPrId}, ${companyId}, ${id}, ${pr.template_id}, ${slugToken()},
        ${pr.title}, ${pr.status}, ${pr.cover_note}, ${pr.sent_at}, ${pr.accepted_at}, ${pr.created_by}
      )
    `;
    const items = await sql<ProposalItem>`
      select * from proposal_items where proposal_id = ${pr.id} order by sort_order
    `;
    for (const item of items) {
      await sql`
        insert into proposal_items (
          id, proposal_id, sort_order, name, description, qty, unit, unit_price, unit_cost,
          included, optional, category, manufacturer, product_name, sku, color,
          location_note, warranty_years, warranty_terms, homeowner_note
        ) values (
          ${crypto.randomUUID()}, ${newPrId}, ${item.sort_order}, ${item.name}, ${item.description},
          ${num(item.qty)}, ${item.unit}, ${num(item.unit_price)}, ${item.unit_cost == null ? null : num(item.unit_cost)},
          ${Boolean(item.included)}, ${Boolean(item.optional)}, ${item.category},
          ${item.manufacturer}, ${item.product_name}, ${item.sku}, ${item.color},
          ${item.location_note}, ${item.warranty_years}, ${item.warranty_terms}, ${item.homeowner_note}
        )
      `;
    }
    const messages = await sql<ProposalMessage>`
      select * from proposal_messages where proposal_id = ${pr.id} order by created_at
    `;
    for (const m of messages) {
      await sql`
        insert into proposal_messages (id, proposal_id, author_role, author_name, body, created_at)
        values (${crypto.randomUUID()}, ${newPrId}, ${m.author_role}, ${m.author_name}, ${m.body}, ${m.created_at})
      `;
    }
  }

  return (await sql<Property>`select * from properties where id = ${id}`)[0]!;
}

export const listPriceBook = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const { company, role } = await shopFor(sql, context.userId, session?.email);
    const rows = await sql<PriceBookItem>`
      select * from price_book where company_id = ${company.id} order by trade, slot, product_name
    `;
    return { role, items: rows.map(hydrateBook) };
  });

export const upsertPriceBookItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      id?: string;
      trade: string;
      slot: string;
      manufacturer: string;
      product_name: string;
      sku: string;
      color: string;
      unit: string;
      cost: string;
      sell: string;
      warranty_years: string;
      warranty_terms: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const { company, role } = await shopFor(sql, context.userId, session?.email);
    if (role !== "owner") throw new Error("Only the owner can edit the price book.");
    const product = data.product_name.trim();
    if (!product) throw new Error("Product name is required");
    const cost = data.cost.trim() === "" ? null : num(data.cost);
    const sell = data.sell.trim() === "" ? null : num(data.sell);
    const years = data.warranty_years.trim() === "" ? null : num(data.warranty_years);
    assertBookPrices({ slot: data.slot, product_name: product, cost, sell });
    if (data.id) {
      await sql`
        update price_book set
          trade = ${data.trade},
          slot = ${data.slot},
          manufacturer = ${data.manufacturer.trim() || null},
          product_name = ${product},
          sku = ${data.sku.trim() || null},
          color = ${data.color.trim() || null},
          unit = ${data.unit.trim() || "ea"},
          cost = ${cost},
          sell = ${sell},
          warranty_years = ${years},
          warranty_terms = ${data.warranty_terms.trim() || null},
          updated_at = now()
        where id = ${data.id} and company_id = ${company.id}
      `;
      return { id: data.id };
    }
    const id = crypto.randomUUID();
    await sql`
      insert into price_book (
        id, company_id, trade, slot, manufacturer, product_name, sku, color, unit,
        cost, sell, warranty_years, warranty_terms
      ) values (
        ${id}, ${company.id}, ${data.trade}, ${data.slot}, ${data.manufacturer.trim() || null},
        ${product}, ${data.sku.trim() || null}, ${data.color.trim() || null}, ${data.unit.trim() || "ea"},
        ${cost}, ${sell}, ${years}, ${data.warranty_terms.trim() || null}
      )
    `;
    return { id };
  });

export const archivePriceBookItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const { company, role } = await shopFor(sql, context.userId, session?.email);
    if (role !== "owner") throw new Error("Only the owner can edit the price book.");
    await sql`update price_book set active = false, updated_at = now() where id = ${id} and company_id = ${company.id}`;
    return { ok: true as const };
  });

export const importPriceBookCsv = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((csv: string) => csv)
  .handler(async ({ context, data: csv }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const { company, role } = await shopFor(sql, context.userId, session?.email);
    if (role !== "owner") throw new Error("Only the owner can edit the price book.");
    const rows = parseBookCsv(csv);
    for (const row of rows) {
      await sql`
        insert into price_book (
          id, company_id, trade, slot, manufacturer, product_name, sku, color, unit,
          cost, sell, warranty_years, warranty_terms
        ) values (
          ${crypto.randomUUID()}, ${company.id}, ${row.trade}, ${row.slot}, ${row.manufacturer},
          ${row.product_name}, ${row.sku}, ${row.color}, ${row.unit},
          ${row.cost}, ${row.sell}, ${row.warranty_years}, ${row.warranty_terms}
        )
      `;
    }
    return { count: rows.length };
  });

export const listTeam = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const { company, role } = await shopFor(sql, context.userId, session?.email);
    const members = await sql<CompanyMember>`
      select * from company_members where company_id = ${company.id} order by role, email
    `;
    return { role, members };
  });

export const addTeamMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { email: string; role: ShopRole }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const { company, role } = await shopFor(sql, context.userId, session?.email);
    if (role !== "owner") throw new Error("Only the owner can add the sales team.");
    const email = data.email.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Need a real email");
    const userId = await userIdForEmail(sql, email);
    await sql`
      insert into company_members (id, company_id, user_id, email, role)
      values (${crypto.randomUUID()}, ${company.id}, ${userId}, ${email}, ${data.role === "owner" ? "owner" : "sales"})
      on conflict (company_id, email) do update set role = excluded.role, user_id = coalesce(excluded.user_id, company_members.user_id)
    `;
    return { ok: true as const };
  });

export const approveProposal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const { company, role } = await shopFor(sql, context.userId, session?.email);
    if (role !== "owner") throw new Error("Only the owner can approve a quote.");
    const rows = await sql<Proposal>`
      select * from proposals where id = ${id} and company_id = ${company.id} limit 1
    `;
    if (!rows[0]) throw new Error("Proposal not found");
    const items = await sql<ProposalItem>`select * from proposal_items where proposal_id = ${id}`;
    for (const item of items) {
      if (item.unit_cost == null || !item.product_name) continue;
      await sql`
        update price_book
        set cost = coalesce(cost, ${num(item.unit_cost)}),
            sell = coalesce(sell, ${num(item.unit_price)}),
            updated_at = now()
        where company_id = ${company.id}
          and product_name = ${item.product_name}
          and coalesce(manufacturer, '') = coalesce(${item.manufacturer}, '')
          and cost is null
      `;
    }
    await sql`
      update proposals
      set status = ${"sent"}, sent_at = now()
      where id = ${id}
    `;
    await sql`update properties set invite_status = ${"sent"} where id = ${rows[0].property_id}`;
    return { ok: true as const };
  });

export const adoptSampleHouse = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const company = await companyFor(sql, context.userId, session?.email);
    const existing = await sql<Property>`
      select * from properties
      where company_id = ${company.id} and address_line = ${"142 Maple Street"}
      limit 1
    `;
    if (existing[0]) return { propertyId: existing[0].id, already: true as const };
    const source = await sql<Property>`select * from properties where id = ${"prop_maple"} limit 1`;
    if (!source[0]) throw new Error("Sample house is not available");
    const cloned = await cloneProperty(sql, source[0], company.id);
    return { propertyId: cloned.id, already: false as const };
  });

export const claimInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((token: string) => token)
  .handler(async ({ context, data: token }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const rows = await sql<Property>`
      select * from properties where invite_token = ${token} or share_token = ${token} limit 1
    `;
    if (!rows[0]) throw new Error("Invitation not found");
    if (session?.email) {
      await bindHomeownerByEmail(sql, context.userId, session.email);
    }
    await sql`
      update properties
      set homeowner_user_id = ${context.userId}, invite_status = ${"claimed"}
      where id = ${rows[0].id}
    `;
    const updated = (await sql<Property>`select * from properties where id = ${rows[0].id}`)[0]!;
    return loadHouse(sql, updated);
  });

export const getMyHouses = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    if (session?.email) {
      await bindHomeownerByEmail(sql, context.userId, session.email);
    }
    const properties = await sql<HomeownerHouse>`
      select p.*,
        c.name as company_name,
        (select count(*)::int from property_facts f where f.property_id = p.id) as fact_count,
        (select count(*)::int from property_photos ph where ph.property_id = p.id) as photo_count,
        (select count(*)::int from jobs j where j.property_id = p.id) as job_count,
        (select count(*)::int from proposals pr where pr.property_id = p.id and pr.status in ('draft','sent','revised','accepted')) as open_proposal_count,
        (select ph.src from property_photos ph where ph.property_id = p.id order by case when ph.category = 'exterior' then 0 else 1 end, ph.created_at desc limit 1) as cover_src,
        (select pr.title from proposals pr where pr.property_id = p.id and pr.status in ('draft','sent','revised','accepted') order by pr.created_at desc limit 1) as open_title,
        (select pr.share_token from proposals pr where pr.property_id = p.id and pr.status in ('draft','sent','revised','accepted') order by pr.created_at desc limit 1) as open_token
      from properties p
      join companies c on c.id = p.company_id
      where p.homeowner_user_id = ${context.userId}
      order by p.created_at desc
    `;
    return {
      houses: properties.map((p) => ({
        ...listRowFromCounts(p),
        company_name: p.company_name,
        open_title: p.open_title,
        open_token: p.open_token,
      })),
    };
  });

async function attachRfpQuote(
  sql: Sql,
  token: string,
  companyId: string,
  proposalId: string,
  property: Property,
) {
  const rows = await sql<Rfp>`select * from rfps where share_token = ${token} limit 1`;
  const rfp = rows[0];
  if (!rfp || rfp.status !== "open") return;
  await sql`
    insert into rfp_quotes (id, rfp_id, company_id, proposal_id)
    values (${crypto.randomUUID()}, ${rfp.id}, ${companyId}, ${proposalId})
    on conflict (rfp_id, company_id) do update set proposal_id = excluded.proposal_id
  `;
  if (!rfp.property_id) {
    await sql`update rfps set property_id = ${property.id} where id = ${rfp.id}`;
  }
}

export const startHomeownerPlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((plan: HomeownerPlan) => plan)
  .handler(async ({ context, data: plan }) => {
    const sql = await getSql();
    await sql`
      insert into homeowner_profiles (user_id, plan, status)
      values (${context.userId}, ${plan}, ${"active"})
      on conflict (user_id) do update set plan = excluded.plan, status = ${"active"}
    `;
    const rows = await sql<HomeownerProfile>`
      select * from homeowner_profiles where user_id = ${context.userId}
    `;
    return rows[0]!;
  });

export const getHomeownerAccount = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<HomeownerProfile>`
      select * from homeowner_profiles where user_id = ${context.userId} limit 1
    `;
    const rfps = await sql<Rfp>`
      select * from rfps where user_id = ${context.userId} order by created_at desc
    `;
    return { profile: rows[0] ?? null, rfps };
  });

export const createRfp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      houseToken?: string;
      workId: string;
      title: string;
      body: string;
      budget?: string;
      addressLine?: string;
      city?: string;
      state?: string;
      zip?: string;
      homeownerName?: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    let profile = (
      await sql<HomeownerProfile>`select * from homeowner_profiles where user_id = ${context.userId} limit 1`
    )[0];
    if (!profile) {
      await sql`
        insert into homeowner_profiles (user_id, plan, status)
        values (${context.userId}, ${"basic"}, ${"active"})
        on conflict (user_id) do nothing
      `;
      profile = (
        await sql<HomeownerProfile>`select * from homeowner_profiles where user_id = ${context.userId} limit 1`
      )[0]!;
    }
    if (profile.plan === "basic") {
      throw new Error("RFPs are a Pro feature. Upgrade to put work on the market.");
    }
    if (!WORK_BY_ID[data.workId]) throw new Error("Pick a trade.");
    const title = data.title.trim();
    const body = data.body.trim();
    if (title.length < 4) throw new Error("Name the job in a sentence.");
    if (body.length < 12) throw new Error("Tell the shops what you need.");

    let property: Property | null = null;
    if (data.houseToken) {
      const found = await sql<Property>`
        select * from properties where share_token = ${data.houseToken} or invite_token = ${data.houseToken} limit 1
      `;
      property = found[0] ?? null;
      if (property && property.homeowner_user_id && property.homeowner_user_id !== context.userId) {
        throw new Error("This File belongs to another household.");
      }
      if (property && !property.homeowner_user_id) {
        await sql`
          update properties set homeowner_user_id = ${context.userId}, invite_status = ${"claimed"}
          where id = ${property.id}
        `;
        property.homeowner_user_id = context.userId;
      }
    }

    const address = (property?.address_line || data.addressLine || "").trim();
    const city = (property?.city || data.city || "").trim();
    const state = (property?.state || data.state || "").trim();
    const zip = (property?.zip || data.zip || "").trim();
    if (address.length < 3) throw new Error("Need the job address.");
    const name =
      data.homeownerName?.trim() ||
      property?.homeowner_name ||
      session?.email?.split("@")[0] ||
      "Homeowner";

    const id = crypto.randomUUID();
    const token = slugToken();
    await sql`
      insert into rfps (
        id, share_token, user_id, property_id, work_id, title, body, budget,
        address_line, city, state, zip, homeowner_name, status
      ) values (
        ${id}, ${token}, ${context.userId}, ${property?.id ?? null}, ${data.workId},
        ${title}, ${body}, ${data.budget?.trim() || null},
        ${address}, ${city || "—"}, ${state || "—"}, ${zip || "—"}, ${name}, ${"open"}
      )
    `;
    return (await sql<Rfp>`select * from rfps where id = ${id}`)[0]!;
  });

export const listMarketRfps = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const { company } = await shopFor(sql, context.userId, session?.email);
    const trades = (company.trades ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const rows = await sql<Rfp>`
      select * from rfps where status = ${"open"} order by created_at desc limit 50
    `;
    const matched = trades.length ? rows.filter((r) => trades.includes(r.work_id)) : rows;
    return { rfps: matched.length ? matched : rows, trades };
  });

export const getRfpByToken = createServerFn({ method: "GET" })
  .validator((token: string) => token)
  .handler(async ({ data: token }) => {
    const sql = await getSql();
    const rows = await sql<Rfp>`select * from rfps where share_token = ${token} limit 1`;
    if (!rows[0]) throw new Error("Request not found");
    const quotes = await sql<RfpQuote>`
      select q.id, q.rfp_id, q.company_id, q.proposal_id, q.created_at,
        c.name as company_name, pr.title as proposal_title, pr.share_token as proposal_token,
        pr.status as proposal_status
      from rfp_quotes q
      join companies c on c.id = q.company_id
      join proposals pr on pr.id = q.proposal_id
      where q.rfp_id = ${rows[0].id}
      order by q.created_at desc
    `;
    const house = rows[0].property_id
      ? (await sql<Property>`select * from properties where id = ${rows[0].property_id}`)[0] ?? null
      : null;
    return { rfp: rows[0], quotes, houseToken: house?.share_token ?? null };
  });

export const closeRfp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((token: string) => token)
  .handler(async ({ context, data: token }) => {
    const sql = await getSql();
    const rows = await sql<Rfp>`select * from rfps where share_token = ${token} limit 1`;
    if (!rows[0] || rows[0].user_id !== context.userId) throw new Error("Request not found");
    await sql`update rfps set status = ${"closed"} where id = ${rows[0].id}`;
    return { ok: true as const };
  });

const HOUSEHOLD_COMPANY = "co_household";

function renewsOn(cadence: "monthly" | "annual") {
  const d = new Date();
  if (cadence === "annual") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

async function seedMaintenance(sql: Sql, propertyId: string) {
  const existing = await sql<{ c: number }>`
    select count(*)::int as c from maintenance_tasks where property_id = ${propertyId}
  `;
  if (num(existing[0]?.c) > 0) return;
  const start = new Date();
  for (const item of MAINTENANCE_LIBRARY) {
    await sql`
      insert into maintenance_tasks (id, property_id, title, system_name, cadence, due_on)
      values (
        ${crypto.randomUUID()}, ${propertyId}, ${item.title}, ${item.system}, ${item.cadence},
        ${nextDue(item.cadence, start)}
      )
    `;
  }
}

export const getHousehold = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    if (session?.email) await bindHomeownerByEmail(sql, context.userId, session.email);
    const profile = (
      await sql<HomeownerProfile>`select * from homeowner_profiles where user_id = ${context.userId} limit 1`
    )[0] ?? null;
    const houses = await sql<HomeownerHouse>`
      select p.*,
        c.name as company_name,
        (select count(*)::int from property_facts f where f.property_id = p.id) as fact_count,
        (select count(*)::int from property_photos ph where ph.property_id = p.id) as photo_count,
        (select count(*)::int from jobs j where j.property_id = p.id) as job_count,
        (select count(*)::int from proposals pr where pr.property_id = p.id and pr.status in ('draft','sent','revised','accepted')) as open_proposal_count,
        (select ph.src from property_photos ph where ph.property_id = p.id order by case when ph.category = 'exterior' then 0 else 1 end, ph.created_at desc limit 1) as cover_src,
        (select pr.title from proposals pr where pr.property_id = p.id and pr.status in ('draft','sent','revised','accepted') order by pr.created_at desc limit 1) as open_title,
        (select pr.share_token from proposals pr where pr.property_id = p.id and pr.status in ('draft','sent','revised','accepted') order by pr.created_at desc limit 1) as open_token
      from properties p
      join companies c on c.id = p.company_id
      where p.homeowner_user_id = ${context.userId}
      order by p.created_at desc
    `;
    const plans = await sql<PropertyPlan>`
      select pp.* from property_plans pp
      join properties p on p.id = pp.property_id
      where p.homeowner_user_id = ${context.userId}
    `;
    const openTasks = await sql<{ property_id: string; due_on: string }>`
      select t.property_id, t.due_on from maintenance_tasks t
      join properties p on p.id = t.property_id
      where p.homeowner_user_id = ${context.userId} and t.completed_at is null
    `;
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 14);
    const dueBy = new Map<string, number>();
    for (const t of openTasks) {
      if (new Date(t.due_on) <= horizon) {
        dueBy.set(t.property_id, (dueBy.get(t.property_id) ?? 0) + 1);
      }
    }
    const planBy = new Map(plans.map((p) => [p.property_id, p]));
    return {
      profile,
      houses: houses.map((h) => ({
        ...listRowFromCounts(h),
        company_name: h.company_name,
        open_title: h.open_title,
        open_token: h.open_token,
        plan: planBy.get(h.id) ?? null,
        dueSoon: dueBy.get(h.id) ?? 0,
      })),
    };
  });

export const createHomeProperty = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      addressLine: string;
      city: string;
      state: string;
      zip: string;
      cadence: "monthly" | "annual";
      tier: "standard" | "pro";
      name?: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const address = data.addressLine.trim();
    if (address.length < 3) throw new Error("Need the street address.");
    await sql`
      insert into homeowner_profiles (user_id, plan, status)
      values (${context.userId}, ${data.tier === "pro" ? "plus" : "basic"}, ${"active"})
      on conflict (user_id) do update set
        plan = case
          when excluded.plan = ${"plus"} then ${"plus"}
          else homeowner_profiles.plan
        end
    `;
    const id = crypto.randomUUID();
    const name = data.name?.trim() || session?.email?.split("@")[0] || "Homeowner";
    await sql`
      insert into properties (
        id, company_id, share_token, invite_token, invite_status,
        address_line, city, state, zip, homeowner_name, homeowner_email, homeowner_user_id
      ) values (
        ${id}, ${HOUSEHOLD_COMPANY}, ${slugToken()}, ${slugToken()}, ${"claimed"},
        ${address}, ${data.city.trim() || "—"}, ${data.state.trim() || "GA"}, ${data.zip.trim() || "—"},
        ${name}, ${session?.email ?? ""}, ${context.userId}
      )
    `;
    await sql`
      insert into property_plans (property_id, cadence, tier, status, renews_on)
      values (${id}, ${data.cadence}, ${data.tier}, ${"active"}, ${renewsOn(data.cadence)})
    `;
    await seedMaintenance(sql, id);
    return { propertyId: id };
  });

export const getHomeRecord = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const rows = await sql<Property>`
      select * from properties where id = ${id} and homeowner_user_id = ${context.userId} limit 1
    `;
    if (!rows[0]) throw new Error("Property not found");
    await seedMaintenance(sql, id);
    const house = await loadHouse(sql, rows[0]);
    const plan = (
      await sql<PropertyPlan>`select * from property_plans where property_id = ${id} limit 1`
    )[0] ?? null;
    const tasks = await sql<MaintenanceTask>`
      select * from maintenance_tasks where property_id = ${id}
      order by completed_at nulls first, due_on
    `;
    const transfer = (
      await sql<PropertyTransfer>`
        select * from property_transfers
        where property_id = ${id} and status = ${"pending"}
        order by created_at desc limit 1
      `
    )[0] ?? null;
    return { house, plan, tasks, transfer };
  });

export const completeMaintenance = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { taskId: string; notes?: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const task = (
      await sql<MaintenanceTask & { homeowner_user_id: string; cadence: string }>`
        select t.*, p.homeowner_user_id from maintenance_tasks t
        join properties p on p.id = t.property_id
        where t.id = ${data.taskId} limit 1
      `
    )[0];
    if (!task || task.homeowner_user_id !== context.userId) throw new Error("Task not found");
    await sql`
      update maintenance_tasks
      set completed_at = now(), notes = ${data.notes?.trim() || task.notes}
      where id = ${task.id}
    `;
    await sql`
      insert into maintenance_tasks (id, property_id, title, system_name, cadence, due_on)
      values (
        ${crypto.randomUUID()}, ${task.property_id}, ${task.title}, ${task.system_name}, ${task.cadence},
        ${nextDue(task.cadence as "monthly" | "quarterly" | "semiannual" | "annual")}
      )
    `;
    return { ok: true as const };
  });

export const startPropertyTransfer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { propertyId: string; toEmail: string; reason: "sale" | "death" }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const property = (
      await sql<Property>`
        select * from properties where id = ${data.propertyId} and homeowner_user_id = ${context.userId} limit 1
      `
    )[0];
    if (!property) throw new Error("Property not found");
    const email = data.toEmail.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Need the new owner's email.");
    const token = slugToken();
    await sql`
      insert into property_transfers (id, property_id, from_user_id, to_email, reason, token, status)
      values (
        ${crypto.randomUUID()}, ${property.id}, ${context.userId}, ${email}, ${data.reason}, ${token}, ${"pending"}
      )
    `;
    return { token };
  });

export const claimPropertyTransfer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((token: string) => token)
  .handler(async ({ context, data: token }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const rows = await sql<PropertyTransfer>`
      select * from property_transfers where token = ${token} and status = ${"pending"} limit 1
    `;
    if (!rows[0]) throw new Error("Transfer not found");
    const mine = session?.email?.toLowerCase();
    if (mine && mine !== rows[0].to_email) {
      throw new Error("Sign in with the email this File was sent to.");
    }
    await sql`
      update properties set homeowner_user_id = ${context.userId} where id = ${rows[0].property_id}
    `;
    await sql`update property_transfers set status = ${"accepted"} where id = ${rows[0].id}`;
    return { propertyId: rows[0].property_id };
  });

export type Audience = {
  signedIn: boolean;
  kind: "guest" | "homeowner" | "contractor";
  paying: boolean;
  homePath: "/" | "/home" | "/app" | "/start" | "/open";
};

export const getAudience = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .handler(async ({ context }): Promise<Audience> => {
    const userId = context.userId;
    if (!userId) return { signedIn: false, kind: "guest", paying: false, homePath: "/" };
    const sql = await getSql();
    const owned = await sql<Company>`
      select * from companies
      where user_id = ${userId} and id <> ${HOUSEHOLD_COMPANY}
      limit 1
    `;
    const member = owned[0]
      ? []
      : await sql<Company>`
          select c.*
          from company_members m
          join companies c on c.id = m.company_id
          where m.user_id = ${userId} and c.id <> ${HOUSEHOLD_COMPANY}
          limit 1
        `;
    const shop = owned[0] ?? member[0] ?? null;
    const contractorPaying = Boolean(shop?.onboarded_at);
    const plans = await sql<{ status: string }>`
      select pp.status
      from property_plans pp
      join properties p on p.id = pp.property_id
      where p.homeowner_user_id = ${userId}
    `;
    const houseCount = await sql<{ c: number }>`
      select count(*)::int as c from properties where homeowner_user_id = ${userId}
    `;
    const homeownerPaying =
      plans.some((p) => p.status === "active" || p.status === "paid" || p.status === "trialing") ||
      (houseCount[0]?.c ?? 0) > 0;

    if (contractorPaying && !homeownerPaying) {
      return { signedIn: true, kind: "contractor", paying: true, homePath: "/app" };
    }
    if (homeownerPaying && !contractorPaying) {
      return { signedIn: true, kind: "homeowner", paying: true, homePath: "/home" };
    }
    if (contractorPaying && homeownerPaying) {
      return { signedIn: true, kind: "contractor", paying: true, homePath: "/app" };
    }
    if (shop) {
      return { signedIn: true, kind: "contractor", paying: false, homePath: "/open" };
    }
    return { signedIn: true, kind: "homeowner", paying: false, homePath: "/start" };
  });



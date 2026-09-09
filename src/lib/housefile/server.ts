import { createServerFn } from "@tanstack/react-start";
import { authMiddleware, optionalAuthMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { LEGAL_EMAIL } from "@/lib/legal";
import { MANAGE_INCLUDED } from "./pricing";
import { applyPriceBook, assertBookPrices, catalogFor, hydrateBook, parseBookCsv, STARTER_BOOK, type PriceBookItem } from "./book";
import {
  KIT_SEEDS,
  catalogHeaderFromCsv,
  isCatalogCsvHeader,
  parseCatalogCsv,
  type WorkKit,
  type WorkKitItem,
} from "./kits";
import { FIELD_CATALOG } from "./fields";
import { coverLetter } from "./cover-letter";
import { num, shopSlugFromName, slugToken } from "./format";
import { asPaymentTerms, normalizePaymentLink } from "./payment";
import { parseStreet, standardizeFromCensus, suggestFromPhoton, type AddressHit } from "./geocode";
import {
  ESTIMATE_KEY,
  estimatePhotos,
  estimateReady,
  parseEstimateLines,
  toQuoteLines,
} from "./estimate-lines";
import {
  buildQuote,
  customWorkId,
  factsFromTakeoff,
  parseTradeTokens,
  workForTemplate,
  workFromId,
  workTypesFor,
  WORK_BY_ID,
  WORK_TYPES,
} from "./quote";
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
  ShopClientRow,
  ShopWorkRow,
  ProposalMessage,
  Template,
  TemplateItem,
  HomeownerHouse,
  HomeownerPlan,
  HomeownerProfile,
  MaintenanceTask,
  Portfolio,
  PortfolioMember,
  PortfolioRole,
  PropertyPlan,
  PropertyTransfer,
  Rfp,
  RfpQuote,
  ShopRole,
} from "./types";
import { MAINTENANCE_LIBRARY, nextDue } from "./maintain";

const HOUSEHOLD_COMPANY = "co_household";

function asCompany(row: Company): Company {
  return {
    ...row,
    logo_src: row.logo_src ?? null,
    agreement: row.agreement ?? null,
    terms: row.terms ?? null,
    trades: row.trades ?? null,
    onboarded_at: row.onboarded_at ?? null,
    shop_paid_at: row.shop_paid_at ?? null,
    payment_terms: row.payment_terms ?? null,
    payment_link: row.payment_link ?? null,
    kits_seeded_at: row.kits_seeded_at ?? null,
    slug: row.slug ?? null,
  };
}

async function ensureShopSlug(sql: Sql, company: Company): Promise<Company> {
  if (company.slug) return company;
  let slug = shopSlugFromName(company.name);
  for (let i = 0; i < 8; i++) {
    const taken = await sql<{ id: string }>`
      select id from companies where slug = ${slug} and id <> ${company.id} limit 1
    `;
    if (!taken[0]) {
      try {
        await sql`update companies set slug = ${slug} where id = ${company.id}`;
        return { ...company, slug };
      } catch {
        // Unique race — pick another slug.
      }
    }
    slug = `${shopSlugFromName(company.name)}-${slugToken().slice(0, 4)}`;
  }
  slug = `shop-${slugToken()}`;
  await sql`update companies set slug = ${slug} where id = ${company.id}`;
  return { ...company, slug };
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
    payment_terms: c.payment_terms ?? null,
    payment_link: c.payment_link ?? null,
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
  const owned = await sql<Company>`
    select * from companies
    where user_id = ${userId} and id <> ${HOUSEHOLD_COMPANY}
    limit 1
  `;
  if (owned[0]) {
    await ensureOwnerMember(sql, owned[0], email);
    await ensureStarterBook(sql, owned[0].id);
    return { company: await ensureShopSlug(sql, asCompany(owned[0])), role: "owner" };
  }
  const byUser = await sql<(Company & { member_role: string })>`
    select c.*, m.role as member_role
    from company_members m
    join companies c on c.id = m.company_id
    where m.user_id = ${userId} and c.id <> ${HOUSEHOLD_COMPANY}
    limit 1
  `;
  if (byUser[0]) {
    const { member_role, ...rest } = byUser[0];
    return {
      company: await ensureShopSlug(sql, asCompany(rest as Company)),
      role: member_role === "owner" ? "owner" : "sales",
    };
  }
  const normalized = email?.trim().toLowerCase() ?? "";
  if (normalized) {
    const byEmail = await sql<(Company & { member_id: string; member_role: string })>`
      select c.*, m.id as member_id, m.role as member_role
      from company_members m
      join companies c on c.id = m.company_id
      where lower(m.email) = ${normalized} and c.id <> ${HOUSEHOLD_COMPANY}
      limit 1
    `;
    if (byEmail[0]) {
      await sql`update company_members set user_id = ${userId} where id = ${byEmail[0].member_id}`;
      const { member_id: _id, member_role, ...rest } = byEmail[0];
      return {
        company: await ensureShopSlug(sql, asCompany(rest as Company)),
        role: member_role === "owner" ? "owner" : "sales",
      };
    }
  }
  throw new Error("Open a shop to send estimates.");
}

async function requirePaidShop(sql: Sql, userId: string, email?: string | null) {
  const shop = await shopFor(sql, userId, email);
  if (!shop.company.shop_paid_at) {
    throw new Error("Open a shop to send estimates.");
  }
  return shop;
}

async function companyFor(sql: Sql, userId: string, email?: string | null): Promise<Company> {
  return (await requirePaidShop(sql, userId, email)).company;
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
      ${"Twelve openings. Sales picked Marvin Essential. The yard cost is not in materials yet."},
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
      description: "Unit, flashing, and install. Low-E glass. Yard cost proposed — not yet in materials.",
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
      ${"Quoted Marvin Essential at $480 a unit from the yard. Cost is not in materials. Margaret should not see this until you approve the number."}
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

function collapseSameAddress<T extends {
  address_line: string;
  zip: string;
  fact_count: number;
  photo_count: number;
  job_count: number;
  plan?: PropertyPlan | null;
}>(houses: T[]): T[] {
  const by = new Map<string, T>();
  for (const house of houses) {
    const key = `${house.address_line.trim().toLowerCase()}|${house.zip.trim()}`;
    const prev = by.get(key);
    if (!prev) {
      by.set(key, house);
      continue;
    }
    const score = (h: T) => h.fact_count + h.photo_count + h.job_count;
    const keep = score(house) > score(prev) ? house : prev;
    const standard = [house.plan, prev.plan].find((pl) => pl?.tier === "standard");
    if (standard) keep.plan = standard;
    else if (!keep.plan) keep.plan = house.plan ?? prev.plan ?? null;
    by.set(key, keep);
  }
  return [...by.values()];
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
    const { company, role } = await requirePaidShop(sql, context.userId, session?.email);
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
    const houses = properties.map((p) => ({
      ...p,
      fact_count: num(p.fact_count),
      photo_count: num(p.photo_count),
      job_count: num(p.job_count),
      open_proposal_count: num(p.open_proposal_count),
    }));
    return {
      company,
      role,
      pending,
      properties: houses,
      clients: clientsFromHouses(houses),
      proposals,
      templateCount: num(templates[0]?.c),
    };
  });

export const listShopIndex = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const { company, role } = await requirePaidShop(sql, context.userId, session?.email);
    const properties = await sql<PropertyListRow>`
      select p.*,
        (select count(*)::int from property_facts f where f.property_id = p.id) as fact_count,
        (select count(*)::int from property_photos ph where ph.property_id = p.id) as photo_count,
        (select count(*)::int from jobs j where j.property_id = p.id) as job_count,
        (select count(*)::int from proposals pr where pr.property_id = p.id and pr.status in ('draft','pending','sent','revised','accepted')) as open_proposal_count,
        (select ph.src from property_photos ph where ph.property_id = p.id order by case when ph.category = 'exterior' then 0 else 1 end, ph.created_at desc limit 1) as cover_src
      from properties p
      where p.company_id = ${company.id}
      order by p.address_line
    `;
    const houses = properties.map((p) => ({
      ...p,
      fact_count: num(p.fact_count),
      photo_count: num(p.photo_count),
      job_count: num(p.job_count),
      open_proposal_count: num(p.open_proposal_count),
    }));
    const proposalRows = await sql<{
      id: string;
      title: string;
      status: string;
      created_at: string;
      accepted_at: string | null;
      property_id: string;
      address_line: string;
      city: string;
      state: string;
      zip: string;
      homeowner_name: string;
      homeowner_email: string;
      homeowner_phone: string | null;
    }>`
      select pr.id, pr.title, pr.status, pr.created_at, pr.accepted_at, pr.property_id,
        p.address_line, p.city, p.state, p.zip, p.homeowner_name, p.homeowner_email, p.homeowner_phone
      from proposals pr
      join properties p on p.id = pr.property_id
      where pr.company_id = ${company.id} and pr.status <> ${"completed"}
      order by pr.created_at desc
    `;
    const jobRows = await sql<{
      id: string;
      title: string;
      summary: string | null;
      completed_at: string;
      created_at: string;
      property_id: string;
      proposal_id: string | null;
      address_line: string;
      city: string;
      state: string;
      zip: string;
      homeowner_name: string;
      homeowner_email: string;
      homeowner_phone: string | null;
    }>`
      select j.id, j.title, j.summary, j.completed_at, j.created_at, j.property_id, j.proposal_id,
        p.address_line, p.city, p.state, p.zip, p.homeowner_name, p.homeowner_email, p.homeowner_phone
      from jobs j
      join properties p on p.id = j.property_id
      where j.company_id = ${company.id}
      order by j.completed_at desc
    `;
    const openWork: ShopWorkRow[] = proposalRows.map((row) => ({
      id: row.id,
      kind: "proposal",
      title: row.title,
      status: row.status,
      summary: null,
      property_id: row.property_id,
      proposal_id: row.id,
      address_line: row.address_line,
      city: row.city,
      state: row.state,
      zip: row.zip,
      homeowner_name: row.homeowner_name,
      homeowner_email: row.homeowner_email,
      homeowner_phone: row.homeowner_phone,
      created_at: row.created_at,
      completed_at: row.accepted_at,
    }));
    const completedWork: ShopWorkRow[] = jobRows.map((row) => ({
      id: row.id,
      kind: "job",
      title: row.title,
      status: "completed",
      summary: row.summary,
      property_id: row.property_id,
      proposal_id: row.proposal_id,
      address_line: row.address_line,
      city: row.city,
      state: row.state,
      zip: row.zip,
      homeowner_name: row.homeowner_name,
      homeowner_email: row.homeowner_email,
      homeowner_phone: row.homeowner_phone,
      created_at: row.created_at,
      completed_at: row.completed_at,
    }));
    const work = [...openWork, ...completedWork];
    const clients = clientsFromHouses(houses);
    return { role, houses, work, clients };
  });

function clientsFromHouses(houses: PropertyListRow[]): ShopClientRow[] {
  const map = new Map<string, ShopClientRow>();
  for (const house of houses) {
    const email = house.homeowner_email.trim().toLowerCase();
    const key = email || `name:${house.homeowner_name.trim().toLowerCase() || house.id}`;
    const existing = map.get(key);
    const place = {
      id: house.id,
      address_line: house.address_line,
      city: house.city,
      state: house.state,
      zip: house.zip,
    };
    if (!existing) {
      map.set(key, {
        key,
        name: house.homeowner_name.trim() || "Unnamed client",
        email: house.homeowner_email.trim(),
        phone: house.homeowner_phone,
        houseCount: 1,
        jobCount: house.job_count,
        openCount: house.open_proposal_count,
        houses: [place],
      });
      continue;
    }
    existing.houses.push(place);
    existing.houseCount += 1;
    existing.jobCount += house.job_count;
    existing.openCount += house.open_proposal_count;
    if (!existing.phone && house.homeowner_phone) existing.phone = house.homeowner_phone;
    if (!existing.email && house.homeowner_email.trim()) existing.email = house.homeowner_email.trim();
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

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
      payment_terms?: string | null;
      payment_link?: string | null;
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
          trades = ${data.trades === undefined ? company.trades : data.trades},
          payment_terms = ${data.payment_terms === undefined ? company.payment_terms : asPaymentTerms(data.payment_terms)},
          payment_link = ${data.payment_link === undefined ? company.payment_link : normalizePaymentLink(data.payment_link)}
      where id = ${company.id}
    `;
    const rows = await sql<Company>`select * from companies where id = ${company.id}`;
    return asCompany(rows[0]!);
  });

export const addCustomWork = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const { company, role } = await requirePaidShop(sql, context.userId, session?.email);
    if (role !== "owner") throw new Error("Only the owner can add a work category.");
    const name = data.name.trim();
    if (!name) throw new Error("Name the work.");
    if (name.length > 40) throw new Error("Keep the category name under 40 characters.");
    const id = customWorkId(name);
    const existing = parseTradeTokens(company.trades);
    const tokens = existing.length ? existing : WORK_TYPES.map((w) => w.id);
    if (tokens.some((token) => token.toLowerCase() === id.toLowerCase() || token.toLowerCase() === name.toLowerCase())) {
      return { workId: id, already: true as const };
    }
    const next = [...tokens, id];
    await sql`
      update companies
      set trades = ${next.join(",")}
      where id = ${company.id}
    `;
    return { workId: id, already: false as const };
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
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      yearsInBusiness?: string;
      associations?: string;
      reviewGoogle?: string;
      reviewTrustpilot?: string;
      reviewNextdoor?: string;
      reviewOther?: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const { company, role } = await requirePaidShop(sql, context.userId, session?.email);
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
          street = ${data.street?.trim() || null},
          city = ${data.city?.trim() || null},
          state = ${data.state?.trim() || null},
          zip = ${data.zip?.trim() || null},
          years_in_business = ${Number.isFinite(Number.parseInt(data.yearsInBusiness ?? "", 10)) && Number.parseInt(data.yearsInBusiness ?? "", 10) > 0 ? Number.parseInt(data.yearsInBusiness ?? "", 10) : null},
          associations = ${data.associations?.trim() || null},
          review_google = ${data.reviewGoogle?.trim() || null},
          review_trustpilot = ${data.reviewTrustpilot?.trim() || null},
          review_nextdoor = ${data.reviewNextdoor?.trim() || null},
          review_other = ${data.reviewOther?.trim() || null},
          onboarded_at = ${new Date().toISOString()}
      where id = ${company.id}
    `;
    await sql`update price_book set active = false, updated_at = now() where company_id = ${company.id}`;
    const allowed = new Set(
      trades.map((id) => WORK_BY_ID[id]?.trade).filter((trade): trade is string => Boolean(trade)),
    );
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
    await seedStarterKits(sql, company.id, trades);
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
    const { company, role } = await requirePaidShop(sql, context.userId, session?.email);

    const templates = await sql<Template>`select * from templates where id = ${data.templateId} limit 1`;
    const template = templates[0];
    if (!template) throw new Error("Template not found");
    const tItems = await sql<TemplateItem>`
      select * from template_items where template_id = ${template.id} order by sort_order
    `;
    const takeoff = data.takeoff ?? {};
    const work = workFromId(takeoff.__work) ?? workForTemplate(template.id);
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
        ${title}, ${pending ? "pending" : "sent"}, ${coverLetter(property.homeowner_name, work?.name ?? template.trade)},
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
    let emailed = false;
    if (!pending) {
      try {
        const { deliverEstimateEmail } = await import("./mail");
        await deliverEstimateEmail({ property, proposal, company });
        emailed = true;
      } catch (err) {
        console.error("[mail] estimate send failed", err);
      }
    }
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
      emailed,
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
  .validator((input: { id: string; title: string; coverNote: string; coverPhoto?: string | null }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const company = await companyFor(sql, context.userId, session?.email);
    if (data.coverPhoto !== undefined) {
      await sql`
        update proposals
        set title = ${data.title.trim()}, cover_note = ${data.coverNote}, cover_photo_src = ${data.coverPhoto}
        where id = ${data.id} and company_id = ${company.id}
      `;
    } else {
      await sql`
        update proposals
        set title = ${data.title.trim()}, cover_note = ${data.coverNote}
        where id = ${data.id} and company_id = ${company.id}
      `;
    }
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
      const current = await sql<ProposalItem>`
        select * from proposal_items where id = ${data.itemId} and proposal_id = ${data.proposalId}
      `;
      const nextReview =
        current[0]?.review_status === "change_review" ? "change_accepted" : current[0]?.review_status ?? null;
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
          warranty_terms = ${data.warrantyTerms.trim() || null},
          review_status = ${nextReview}
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
    if (num(count[0]?.c) >= 12) throw new Error("This Property Record already has 12 photos");
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
    const { role } = await requirePaidShop(sql, context.userId, session?.email);
    if (role !== "owner") throw new Error("Only the owner can read inbound leads.");
    const rows = await sql<QuoteLead>`
      select * from quote_leads order by created_at desc limit 100
    `;
    return { leads: rows };
  });

export type PublicShop = {
  slug: string;
  name: string;
  trade: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_src: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  years_in_business: number | null;
  associations: string | null;
  review_google: string | null;
  review_trustpilot: string | null;
  review_nextdoor: string | null;
  review_other: string | null;
  trades: string[];
};

export const getPublicShop = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<PublicShop> => {
    const sql = await getSql();
    const needle = slug.trim().toLowerCase();
    if (!needle) throw new Error("Shop not found");
    const rows = await sql<Company>`
      select * from companies
      where slug = ${needle} and shop_paid_at is not null and id <> ${HOUSEHOLD_COMPANY}
      limit 1
    `;
    const company = rows[0];
    if (!company) throw new Error("Shop not found");
    const hydrated = asCompany(company);
    return {
      slug: hydrated.slug!,
      name: hydrated.name,
      trade: hydrated.trade,
      phone: hydrated.phone,
      email: hydrated.email,
      website: hydrated.website,
      logo_src: hydrated.logo_src,
      street: hydrated.street,
      city: hydrated.city,
      state: hydrated.state,
      zip: hydrated.zip,
      years_in_business: hydrated.years_in_business,
      associations: hydrated.associations,
      review_google: hydrated.review_google,
      review_trustpilot: hydrated.review_trustpilot,
      review_nextdoor: hydrated.review_nextdoor,
      review_other: hydrated.review_other,
      trades: workTypesFor(hydrated.trades).map((w) => w.id),
    };
  });

export const getHouseByToken = createServerFn({ method: "GET" })
  .validator((token: string) => token)
  .handler(async ({ data: token }) => {
    const sql = await getSql();
    const rows = await sql<Property>`
      select * from properties where share_token = ${token} or invite_token = ${token} limit 1
    `;
    if (!rows[0]) throw new Error("Property Record not found");
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
    if (!rows[0]) throw new Error("Property Record not found");
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
    if (!rows[0]) throw new Error("Property Record not found");
    if (!data.src.startsWith("data:image/")) throw new Error("Invalid photo");
    const count = await sql<{ c: number }>`
      select count(*)::int as c from property_photos where property_id = ${rows[0].id}
    `;
    if (num(count[0]?.c) >= 12) throw new Error("This Property Record already has 12 photos");
    await sql`
      insert into property_photos (id, property_id, src, caption, category, uploaded_by)
      values (
        ${crypto.randomUUID()}, ${rows[0].id}, ${data.src},
        ${data.caption.trim() || null}, ${data.category || "general"}, ${"homeowner"}
      )
    `;
    return { ok: true as const };
  });


export const deletePhotoPublic = createServerFn({ method: "POST" })
  .validator((input: { token: string; photoId: string }) => input)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<Property>`
      select * from properties where share_token = ${data.token} or invite_token = ${data.token} limit 1
    `;
    if (!rows[0]) throw new Error("Property Record not found");
    await sql`
      delete from property_photos where id = ${data.photoId} and property_id = ${rows[0].id}
    `;
    return { ok: true as const };
  });

export const deletePhotoContractor = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { propertyId: string; photoId: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const company = await companyFor(sql, context.userId, session?.email);
    await requireOwnedProperty(sql, company.id, data.propertyId);
    await sql`
      delete from property_photos where id = ${data.photoId} and property_id = ${data.propertyId}
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
      reviewStatus?: string;
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
    const review =
      data.reviewStatus !== undefined ? data.reviewStatus : items[0].review_status ?? null;
    await sql`
      update proposal_items
      set included = ${Boolean(included)}, homeowner_note = ${note}, review_status = ${review}
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
    const already = rows[0].status === "accepted" || rows[0].status === "completed";
    if (!already) {
      await sql`
        update proposals set status = ${"accepted"}, accepted_at = now()
        where id = ${rows[0].id}
      `;
    }
    const proposal = (await sql<Proposal>`select * from proposals where id = ${rows[0].id}`)[0]!;
    const property = (await sql<Property>`select * from properties where id = ${proposal.property_id}`)[0]!;
    const company = asCompany(
      (await sql<Company>`select * from companies where id = ${proposal.company_id}`)[0]!,
    );
    const items = await sql<ProposalItem>`
      select * from proposal_items where proposal_id = ${proposal.id} order by sort_order
    `;
    let emailed = false;
    if (!already) {
      try {
        const { deliverAcceptedEstimateEmail } = await import("./mail");
        await deliverAcceptedEstimateEmail({
          property,
          proposal,
          company,
          items: items.map((i) =>
            hydrateItem({ ...i, included: Boolean(i.included), optional: Boolean(i.optional) }),
          ),
        });
        emailed = true;
      } catch (err) {
        console.error("[mail] accepted estimate send failed", err);
      }
    }
    return { ok: true as const, emailed };
  });

export const draftCoverNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { templateName: string; address: string; homeownerName: string }) => input)
  .handler(async ({ data }) => {
    const trade = data.templateName.replace(/—/g, " ").split(" ")[0] || "work";
    return { ok: true as const, text: coverLetter(data.homeownerName, trade.toLowerCase()) };
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
    const { company, role } = await requirePaidShop(sql, context.userId, session?.email);
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
    const { company, role } = await requirePaidShop(sql, context.userId, session?.email);
    if (role !== "owner") throw new Error("Only the owner can edit materials.");
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
    const { company, role } = await requirePaidShop(sql, context.userId, session?.email);
    if (role !== "owner") throw new Error("Only the owner can edit materials.");
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
    const { company, role } = await requirePaidShop(sql, context.userId, session?.email);
    if (role !== "owner") throw new Error("Only the owner can edit materials.");
    const header = catalogHeaderFromCsv(csv);
    if (isCatalogCsvHeader(header)) {
      const catalog = parseCatalogCsv(csv);
      for (const row of catalog.products) {
        assertBookPrices(row);
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
      const grouped = new Map<string, typeof catalog.kitLines>();
      for (const line of catalog.kitLines) {
        const key = `${line.work_id}::${line.sub_category}`;
        const list = grouped.get(key) ?? [];
        list.push(line);
        grouped.set(key, list);
      }
      for (const [key, lines] of grouped) {
        const splitAt = key.indexOf("::");
        const workId = key.slice(0, splitAt);
        const name = key.slice(splitAt + 2);
        const existing = await sql<{ id: string }>`
          select id from work_kits where company_id = ${company.id} and work_id = ${workId} and name = ${name} limit 1
        `;
        let kitId = existing[0]?.id;
        if (kitId) {
          await sql`delete from work_kit_items where kit_id = ${kitId}`;
        } else {
          const max = await sql<{ n: number }>`
            select coalesce(max(sort_order), -1)::int as n from work_kits where company_id = ${company.id} and work_id = ${workId}
          `;
          kitId = crypto.randomUUID();
          await sql`
            insert into work_kits (id, company_id, work_id, name, sort_order)
            values (${kitId}, ${company.id}, ${workId}, ${name}, ${(max[0]?.n ?? -1) + 1})
          `;
        }
        let order = 0;
        for (const line of lines) {
          await sql`
            insert into work_kit_items (id, kit_id, sort_order, name, description, qty, unit, slot)
            values (
              ${crypto.randomUUID()}, ${kitId}, ${order}, ${line.name}, ${line.description || null},
              ${line.qty || null}, ${line.unit || "ls"}, ${line.slot}
            )
          `;
          order += 1;
        }
      }
      return { count: catalog.products.length + catalog.kitLines.length, kits: grouped.size };
    }
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
    return { count: rows.length, kits: 0 };
  });

async function seedStarterKits(sql: Sql, companyId: string, workIds?: string[]) {
  const ids = (workIds === undefined ? Object.keys(KIT_SEEDS) : workIds).filter((id) => KIT_SEEDS[id]?.length);
  for (const workId of ids) {
    const seed = KIT_SEEDS[workId];
    if (!seed?.length) continue;
    const existing = await sql<{ c: number }>`
      select count(*)::int as c from work_kits where company_id = ${companyId} and work_id = ${workId}
    `;
    if ((existing[0]?.c ?? 0) > 0) continue;
    let order = 0;
    for (const kit of seed) {
      const kitId = crypto.randomUUID();
      await sql`
        insert into work_kits (id, company_id, work_id, name, sort_order)
        values (${kitId}, ${companyId}, ${workId}, ${kit.name}, ${order})
      `;
      order += 1;
      let lineOrder = 0;
      for (const line of kit.lines) {
        await sql`
          insert into work_kit_items (id, kit_id, sort_order, name, description, qty, unit, slot)
          values (
            ${crypto.randomUUID()}, ${kitId}, ${lineOrder}, ${line.name}, ${line.description},
            ${line.qty ?? null}, ${line.unit ?? "ls"}, ${line.slot ?? null}
          )
        `;
        lineOrder += 1;
      }
    }
  }
}

async function kitsForCompany(sql: Sql, companyId: string, workId?: string): Promise<WorkKit[]> {
  const company = await sql<{ trades: string | null }>`
    select trades from companies where id = ${companyId} limit 1
  `;
  await seedStarterKits(sql, companyId, parseTradeTokens(company[0]?.trades));
  const kits = workId
    ? await sql<Omit<WorkKit, "items">>`
        select * from work_kits where company_id = ${companyId} and work_id = ${workId} order by sort_order, name
      `
    : await sql<Omit<WorkKit, "items">>`
        select * from work_kits where company_id = ${companyId} order by work_id, sort_order, name
      `;
  if (kits.length === 0) return [];
  const items: WorkKitItem[] = [];
  for (const kit of kits) {
    const rows = await sql<WorkKitItem>`
      select * from work_kit_items where kit_id = ${kit.id} order by sort_order
    `;
    items.push(...rows);
  }
  const byKit = new Map<string, WorkKitItem[]>();
  for (const item of items) {
    const list = byKit.get(item.kit_id) ?? [];
    list.push(item);
    byKit.set(item.kit_id, list);
  }
  return kits.map((kit) => ({ ...kit, items: byKit.get(kit.id) ?? [] }));
}

export const listWorkKits = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input?: { workId?: string }) => input ?? {})
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const { company, role } = await requirePaidShop(sql, context.userId, session?.email);
    const kits = await kitsForCompany(sql, company.id, data.workId);
    return { role, kits };
  });

export const seedWorkKits = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { workId: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const { company, role } = await requirePaidShop(sql, context.userId, session?.email);
    if (role !== "owner") throw new Error("Only the owner can load starter sub-categories.");
    const workId = data.workId.trim();
    if (!KIT_SEEDS[workId]?.length) throw new Error("No starters for that category.");
    await seedStarterKits(sql, company.id, [workId]);
    return { ok: true as const };
  });

export const saveWorkKit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      id?: string;
      workId: string;
      name: string;
      items: { name: string; description?: string; qty?: string; unit?: string; slot?: string }[];
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const { company, role } = await requirePaidShop(sql, context.userId, session?.email);
    if (role !== "owner") throw new Error("Only the owner can edit work categories.");
    const name = data.name.trim();
    if (!name) throw new Error("Name the sub-category.");
    const workId = data.workId.trim();
    if (!workId) throw new Error("Pick a work category.");
    let kitId = data.id;
    if (kitId) {
      const owned = await sql<{ id: string }>`
        select id from work_kits where id = ${kitId} and company_id = ${company.id} limit 1
      `;
      if (!owned[0]) throw new Error("Kit not found");
      await sql`update work_kits set name = ${name}, work_id = ${workId} where id = ${kitId}`;
      await sql`delete from work_kit_items where kit_id = ${kitId}`;
    } else {
      const max = await sql<{ n: number }>`
        select coalesce(max(sort_order), -1)::int as n from work_kits where company_id = ${company.id} and work_id = ${workId}
      `;
      kitId = crypto.randomUUID();
      await sql`
        insert into work_kits (id, company_id, work_id, name, sort_order)
        values (${kitId}, ${company.id}, ${workId}, ${name}, ${(max[0]?.n ?? -1) + 1})
      `;
    }
    let order = 0;
    for (const item of data.items) {
      const itemName = item.name.trim();
      if (!itemName) continue;
      await sql`
        insert into work_kit_items (id, kit_id, sort_order, name, description, qty, unit, slot)
        values (
          ${crypto.randomUUID()}, ${kitId}, ${order}, ${itemName}, ${item.description?.trim() || null},
          ${item.qty?.trim() || null}, ${item.unit?.trim() || "ls"}, ${item.slot?.trim() || null}
        )
      `;
      order += 1;
    }
    return { id: kitId };
  });

export const deleteWorkKit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const { company, role } = await requirePaidShop(sql, context.userId, session?.email);
    if (role !== "owner") throw new Error("Only the owner can edit work categories.");
    await sql`delete from work_kits where id = ${id} and company_id = ${company.id}`;
    return { ok: true as const };
  });

export const listTeam = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const { company, role } = await requirePaidShop(sql, context.userId, session?.email);
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
    const { company, role } = await requirePaidShop(sql, context.userId, session?.email);
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
    const { company, role } = await requirePaidShop(sql, context.userId, session?.email);
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
    const proposal = (await sql<Proposal>`select * from proposals where id = ${id}`)[0]!;
    const property = (await sql<Property>`select * from properties where id = ${proposal.property_id}`)[0]!;
    let emailed = false;
    try {
      const { deliverEstimateEmail } = await import("./mail");
      await deliverEstimateEmail({ property, proposal, company });
      emailed = true;
    } catch (err) {
      console.error("[mail] estimate send after approval failed", err);
    }
    return { ok: true as const, emailed };
  });

export const sendEstimateToHomeowner = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((proposalId: string) => proposalId)
  .handler(async ({ context, data: proposalId }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const { company } = await requirePaidShop(sql, context.userId, session?.email);
    const rows = await sql<Proposal>`
      select * from proposals where id = ${proposalId} and company_id = ${company.id} limit 1
    `;
    const proposal = rows[0];
    if (!proposal) throw new Error("Proposal not found");
    if (proposal.status === "pending") {
      throw new Error("The owner has to approve this quote before it can go to the homeowner.");
    }
    const property = (await sql<Property>`select * from properties where id = ${proposal.property_id}`)[0];
    if (!property) throw new Error("House not found");
    try {
      const { deliverEstimateEmail } = await import("./mail");
      await deliverEstimateEmail({ property, proposal, company });
    } catch (err) {
      console.error("[mail] estimate send failed", err);
      throw new Error(`Could not email the estimate. Write ${LEGAL_EMAIL}.`);
    }
    await sql`
      update proposals set status = ${"sent"}, sent_at = coalesce(sent_at, now()) where id = ${proposal.id}
    `;
    await sql`update properties set invite_status = ${"sent"} where id = ${property.id}`;
    return { ok: true as const, emailed: property.homeowner_email };
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
    if (rows[0].homeowner_user_id && rows[0].homeowner_user_id !== context.userId) {
      throw new Error("This Property Record already belongs to another household.");
    }
    if (session?.email) {
      await bindHomeownerByEmail(sql, context.userId, session.email);
    }
    await sql`
      update properties
      set homeowner_user_id = ${context.userId}, invite_status = ${"claimed"}
      where id = ${rows[0].id}
        and (homeowner_user_id is null or homeowner_user_id = ${context.userId})
    `;
    await ensureHomeownerProfile(sql, context.userId);
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
        throw new Error("This Property Record belongs to another household.");
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
    const { company } = await requirePaidShop(sql, context.userId, session?.email);
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
    await sql`
      update property_plans pp
      set tier = ${"standard"}
      from properties p
      where pp.property_id = p.id
        and p.homeowner_user_id = ${context.userId}
        and pp.tier = ${"pro"}
        and exists (
          select 1
          from properties p2
          join property_plans pp2 on pp2.property_id = p2.id
          where p2.homeowner_user_id = p.homeowner_user_id
            and lower(trim(p2.address_line)) = lower(trim(p.address_line))
            and pp2.tier = ${"standard"}
        )
    `;
    await sql`
      update homeowner_profiles
      set plan = ${"basic"}
      where user_id = ${context.userId}
        and plan = ${"plus"}
        and not exists (
          select 1
          from property_plans pp
          join properties p on p.id = pp.property_id
          where p.homeowner_user_id = ${context.userId}
            and pp.tier = ${"pro"}
        )
    `;
    const profileRow = (
      await sql<HomeownerProfile>`select * from homeowner_profiles where user_id = ${context.userId} limit 1`
    )[0] ?? null;
    const profile = profileRow ? asHomeownerProfile(profileRow) : null;
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
    const listed = houses.map((h) => ({
      ...listRowFromCounts(h),
      company_name: h.company_name,
      open_title: h.open_title,
      open_token: h.open_token,
      plan: planBy.get(h.id) ?? null,
      dueSoon: dueBy.get(h.id) ?? 0,
    }));
    return {
      profile,
      houses: collapseSameAddress(listed),
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
      values (${context.userId}, ${"basic"}, ${"active"})
      on conflict (user_id) do nothing
    `;
    const existing = (
      await sql<Property>`
        select * from properties
        where homeowner_user_id = ${context.userId}
          and lower(trim(address_line)) = ${address.toLowerCase()}
        order by created_at desc
        limit 1
      `
    )[0];
    if (existing) {
      return { propertyId: existing.id };
    }
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
  .validator((input: { propertyId: string; toEmail: string }) => input)
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
        ${crypto.randomUUID()}, ${property.id}, ${context.userId}, ${email}, ${"transfer"}, ${token}, ${"pending"}
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
      throw new Error("Sign in with the email this Property Record was sent to.");
    }
    await sql`
      update properties set homeowner_user_id = ${context.userId} where id = ${rows[0].property_id}
    `;
    await sql`update property_transfers set status = ${"accepted"} where id = ${rows[0].id}`;
    return { propertyId: rows[0].property_id };
  });


export const getAccount = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const email = session?.email ?? null;

    const owned = await sql<{ id: string; name: string }>`
      select id, name from companies
      where user_id = ${context.userId} and id <> ${HOUSEHOLD_COMPANY}
      limit 1
    `;
    let shop: { id: string; name: string; role: "owner" | "sales"; seats: number } | null = null;
    if (owned[0]) {
      const seats = await sql<{ c: number }>`
        select count(*)::int as c from company_members where company_id = ${owned[0].id}
      `;
      shop = { id: owned[0].id, name: owned[0].name, role: "owner", seats: num(seats[0]?.c) };
    } else {
      const byUser = await sql<{ id: string; name: string; member_role: string }>`
        select c.id, c.name, m.role as member_role
        from company_members m
        join companies c on c.id = m.company_id
        where m.user_id = ${context.userId} and c.id <> ${HOUSEHOLD_COMPANY}
        limit 1
      `;
      if (byUser[0]) {
        const seats = await sql<{ c: number }>`
          select count(*)::int as c from company_members where company_id = ${byUser[0].id}
        `;
        shop = {
          id: byUser[0].id,
          name: byUser[0].name,
          role: byUser[0].member_role === "owner" ? "owner" : "sales",
          seats: num(seats[0]?.c),
        };
      }
    }

    if (email) await bindHomeownerByEmail(sql, context.userId, email);
    const houses = await sql<{
      id: string;
      address_line: string;
      city: string;
      cadence: string | null;
      tier: string | null;
      status: string | null;
      renews_on: string | null;
    }>`
      select p.id, p.address_line, p.city, pp.cadence, pp.tier, pp.status, pp.renews_on
      from properties p
      left join property_plans pp on pp.property_id = p.id
      where p.homeowner_user_id = ${context.userId}
      order by p.created_at desc
    `;
    const quotes = shop
      ? await sql<{ c: number }>`
          select count(*)::int as c from proposals where company_id = ${shop.id}
        `
      : [{ c: 0 }];

    let portfolio: {
      id: string;
      name: string;
      paid_at: string | null;
      extra_slots: number;
      extra_seats: number;
      role: "owner" | "staff";
    } | null = null;
    const ownedPortfolio = (
      await sql<{
        id: string;
        name: string;
        paid_at: string | null;
        extra_slots: number;
        extra_seats: number;
      }>`
        select id, name, paid_at, extra_slots, extra_seats from portfolios where user_id = ${context.userId} limit 1
      `
    )[0];
    if (ownedPortfolio) {
      portfolio = { ...ownedPortfolio, extra_seats: num(ownedPortfolio.extra_seats), role: "owner" };
    } else {
      const byUser = (
        await sql<{
          id: string;
          name: string;
          paid_at: string | null;
          extra_slots: number;
          extra_seats: number;
          member_role: string;
        }>`
          select p.id, p.name, p.paid_at, p.extra_slots, p.extra_seats, m.role as member_role
          from portfolio_members m
          join portfolios p on p.id = m.portfolio_id
          where m.user_id = ${context.userId}
          limit 1
        `
      )[0];
      if (byUser) {
        portfolio = {
          id: byUser.id,
          name: byUser.name,
          paid_at: byUser.paid_at,
          extra_slots: byUser.extra_slots,
          extra_seats: num(byUser.extra_seats),
          role: byUser.member_role === "owner" ? "owner" : "staff",
        };
      }
    }
    const portfolioCount = portfolio
      ? await sql<{ c: number }>`
          select count(*)::int as c from portfolio_properties where portfolio_id = ${portfolio.id}
        `
      : [{ c: 0 }];

    const household = (
      await sql<HomeownerProfile>`
        select * from homeowner_profiles where user_id = ${context.userId} limit 1
      `
    )[0];

    return {
      email,
      name: household?.display_name?.trim() || email?.split("@")[0] || "Account",
      shop,
      quoteCount: num(quotes[0]?.c),
      houses: houses.map((h) => ({
        id: h.id,
        address: h.address_line,
        city: h.city,
        cadence: h.cadence,
        tier: h.tier,
        status: h.status,
        renewsOn: h.renews_on,
      })),
      portfolio: portfolio?.paid_at
        ? {
            id: portfolio.id,
            name: portfolio.name,
            houseCount: num(portfolioCount[0]?.c),
            extraSlots: num(portfolio.extra_slots),
            extraSeats: num(portfolio.extra_seats),
            role: portfolio.role,
          }
        : null,
    };
  });

export type AudienceHats = {
  contractor: boolean;
  manager: boolean;
  homeowner: boolean;
};

export type Audience = {
  signedIn: boolean;
  kind: "guest" | "homeowner" | "contractor" | "manager";
  paying: boolean;
  homePath: "/" | "/home" | "/app" | "/shop/open" | "/homeowner" | "/manage" | "/manage/open";
  hats: AudienceHats;
};

const EMPTY_HATS: AudienceHats = { contractor: false, manager: false, homeowner: false };

export const getAudience = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .handler(async ({ context }): Promise<Audience> => {
    const guest: Audience = {
      signedIn: false,
      kind: "guest",
      paying: false,
      homePath: "/",
      hats: EMPTY_HATS,
    };
    const userId = context.userId;
    if (!userId) return guest;
    try {
    const sql = await getSql();
    if (context.email) {
      await sql`
        update portfolio_members
        set user_id = ${userId}
        where lower(email) = ${context.email.trim().toLowerCase()}
          and (user_id is null or user_id = ${userId})
      `;
    }
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
    const contractorPaying = Boolean(shop?.shop_paid_at);
    const ownedPortfolio = await sql<{ paid_at: string | null }>`
      select paid_at from portfolios where user_id = ${userId} limit 1
    `;
    const memberPortfolio = ownedPortfolio[0]
      ? []
      : await sql<{ paid_at: string | null }>`
          select p.paid_at
          from portfolio_members m
          join portfolios p on p.id = m.portfolio_id
          where m.user_id = ${userId}
          limit 1
        `;
    const portfolio = ownedPortfolio[0] ?? memberPortfolio[0] ?? null;
    const managerPaying = Boolean(portfolio?.paid_at);
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
    const hats: AudienceHats = {
      contractor: contractorPaying,
      manager: managerPaying,
      homeowner: homeownerPaying,
    };

    if (contractorPaying) {
      return { signedIn: true, kind: "contractor", paying: true, homePath: "/app", hats };
    }
    if (managerPaying) {
      return { signedIn: true, kind: "manager", paying: true, homePath: "/manage", hats };
    }
    if (homeownerPaying) {
      return { signedIn: true, kind: "homeowner", paying: true, homePath: "/home", hats };
    }
    if (shop) {
      return { signedIn: true, kind: "contractor", paying: false, homePath: "/shop/open", hats };
    }
    if (portfolio) {
      return { signedIn: true, kind: "manager", paying: false, homePath: "/manage/open", hats };
    }
    return { signedIn: true, kind: "homeowner", paying: false, homePath: "/homeowner", hats };
    } catch {
      return { signedIn: true, kind: "guest", paying: false, homePath: "/", hats: EMPTY_HATS };
    }
  });

async function requirePaidPortfolio(
  sql: Sql,
  userId: string,
): Promise<{ portfolio: Portfolio; role: PortfolioRole }> {
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  const session = await getSessionUser();
  const office = await portfolioFor(sql, userId, session?.email);
  if (!office.portfolio.paid_at) throw new Error("Open a portfolio to continue.");
  return office;
}

async function portfolioFor(
  sql: Sql,
  userId: string,
  email?: string | null,
): Promise<{ portfolio: Portfolio; role: PortfolioRole }> {
  const owned = await sql<Portfolio>`
    select * from portfolios where user_id = ${userId} limit 1
  `;
  if (owned[0]) {
    await ensurePortfolioOwnerMember(sql, owned[0], email);
    return { portfolio: asPortfolio(owned[0]), role: "owner" };
  }
  const byUser = await sql<(Portfolio & { member_role: string })>`
    select p.*, m.role as member_role
    from portfolio_members m
    join portfolios p on p.id = m.portfolio_id
    where m.user_id = ${userId}
    limit 1
  `;
  if (byUser[0]) {
    const { member_role, ...rest } = byUser[0];
    return {
      portfolio: asPortfolio(rest as Portfolio),
      role: member_role === "owner" ? "owner" : "staff",
    };
  }
  const normalized = email?.trim().toLowerCase() ?? "";
  if (normalized) {
    const byEmail = await sql<(Portfolio & { member_id: string; member_role: string })>`
      select p.*, m.id as member_id, m.role as member_role
      from portfolio_members m
      join portfolios p on p.id = m.portfolio_id
      where lower(m.email) = ${normalized}
      limit 1
    `;
    if (byEmail[0]) {
      await sql`update portfolio_members set user_id = ${userId} where id = ${byEmail[0].member_id}`;
      const { member_id: _id, member_role, ...rest } = byEmail[0];
      return {
        portfolio: asPortfolio(rest as Portfolio),
        role: member_role === "owner" ? "owner" : "staff",
      };
    }
  }
  throw new Error("Open a portfolio to continue.");
}

async function ensurePortfolioOwnerMember(sql: Sql, portfolio: Portfolio, email?: string | null) {
  const mail = (email || portfolio.email || `owner-${portfolio.id}@local`).trim().toLowerCase();
  await sql`
    insert into portfolio_members (id, portfolio_id, user_id, email, role)
    values (${crypto.randomUUID()}, ${portfolio.id}, ${portfolio.user_id}, ${mail}, ${"owner"})
    on conflict (portfolio_id, email) do update set user_id = excluded.user_id, role = ${"owner"}
  `;
}

function asPortfolio(row: Portfolio): Portfolio {
  return {
    ...row,
    extra_slots: num(row.extra_slots),
    extra_seats: num(row.extra_seats),
    included_count: num(row.included_count) || MANAGE_INCLUDED,
    phone: row.phone ?? null,
    email: row.email ?? null,
    logo_src: row.logo_src ?? null,
  };
}

function asHomeownerProfile(row: HomeownerProfile): HomeownerProfile {
  return {
    ...row,
    display_name: row.display_name ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
  };
}

async function ensureHomeownerProfile(sql: Sql, userId: string) {
  await sql`
    insert into homeowner_profiles (user_id, plan, status)
    values (${userId}, ${"basic"}, ${"active"})
    on conflict (user_id) do nothing
  `;
  const rows = await sql<HomeownerProfile>`
    select * from homeowner_profiles where user_id = ${userId} limit 1
  `;
  return asHomeownerProfile(rows[0]!);
}

export const getPortfolio = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const { portfolio, role } = await requirePaidPortfolio(sql, context.userId);
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
      from portfolio_properties pp
      join properties p on p.id = pp.property_id
      join companies c on c.id = p.company_id
      where pp.portfolio_id = ${portfolio.id}
      order by p.address_line
    `;
    const cap = num(portfolio.included_count) || MANAGE_INCLUDED;
    const extra = num(portfolio.extra_slots);
    const extraSeats = num(portfolio.extra_seats);
    return {
      id: portfolio.id,
      name: portfolio.name,
      phone: portfolio.phone,
      email: portfolio.email,
      logo_src: portfolio.logo_src,
      included: cap,
      extra,
      extraSeats,
      seatCap: 1 + extraSeats,
      role,
      cap: cap + extra,
      houseCount: houses.length,
      houses: houses.map((h) => ({
        ...listRowFromCounts(h),
        company_name: h.company_name,
        open_title: h.open_title,
        open_token: h.open_token,
        homeowner_name: h.homeowner_name,
      })),
    };
  });

export const addPortfolioProperty = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      addressLine: string;
      city: string;
      state: string;
      zip: string;
      ownerName?: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { portfolio } = await requirePaidPortfolio(sql, context.userId);
    const address = data.addressLine.trim();
    if (address.length < 3) throw new Error("Need the street address.");
    const count = await sql<{ c: number }>`
      select count(*)::int as c from portfolio_properties where portfolio_id = ${portfolio.id}
    `;
    const cap = (num(portfolio.included_count) || MANAGE_INCLUDED) + num(portfolio.extra_slots);
    if (num(count[0]?.c) >= cap) {
      return { ok: false as const, needExtra: true as const };
    }
    const existing = (
      await sql<Property>`
        select p.*
        from portfolio_properties pp
        join properties p on p.id = pp.property_id
        where pp.portfolio_id = ${portfolio.id}
          and lower(trim(p.address_line)) = ${address.toLowerCase()}
        limit 1
      `
    )[0];
    if (existing) return { ok: true as const, propertyId: existing.id, needExtra: false as const };
    const id = crypto.randomUUID();
    const owner = data.ownerName?.trim() || "Owner";
    await sql`
      insert into properties (
        id, company_id, share_token, invite_token, invite_status,
        address_line, city, state, zip, homeowner_name, homeowner_email
      ) values (
        ${id}, ${HOUSEHOLD_COMPANY}, ${slugToken()}, ${slugToken()}, ${"pending"},
        ${address}, ${data.city.trim() || "—"}, ${data.state.trim() || "GA"}, ${data.zip.trim() || "—"},
        ${owner}, ${""}
      )
    `;
    await sql`
      insert into portfolio_properties (portfolio_id, property_id)
      values (${portfolio.id}, ${id})
    `;
    await seedMaintenance(sql, id);
    return { ok: true as const, propertyId: id, needExtra: false as const };
  });

export const getPortfolioRecord = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const { portfolio } = await requirePaidPortfolio(sql, context.userId);
    const rows = await sql<Property>`
      select p.*
      from properties p
      join portfolio_properties pp on pp.property_id = p.id
      where p.id = ${id} and pp.portfolio_id = ${portfolio.id}
      limit 1
    `;
    if (!rows[0]) throw new Error("Property not found");
    await seedMaintenance(sql, id);
    const house = await loadHouse(sql, rows[0]);
    const tasks = await sql<MaintenanceTask>`
      select * from maintenance_tasks where property_id = ${id}
      order by completed_at nulls first, due_on
    `;
    return {
      house,
      tasks,
      portfolioName: portfolio.name,
      claimed: Boolean(rows[0].homeowner_user_id),
    };
  });

export const completePortfolioMaintenance = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { taskId: string; notes?: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { portfolio } = await requirePaidPortfolio(sql, context.userId);
    const task = (
      await sql<MaintenanceTask>`
        select t.*
        from maintenance_tasks t
        join portfolio_properties pp on pp.property_id = t.property_id
        where t.id = ${data.taskId} and pp.portfolio_id = ${portfolio.id}
        limit 1
      `
    )[0];
    if (!task) throw new Error("Task not found");
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

export const updatePortfolio = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      name: string;
      phone: string;
      email: string;
      logo_src?: string | null;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { portfolio, role } = await requirePaidPortfolio(sql, context.userId);
    if (role !== "owner") throw new Error("Only the office owner can change office settings.");
    const name = data.name.trim() || portfolio.name;
    await sql`
      update portfolios
      set name = ${name},
          phone = ${data.phone.trim() || null},
          email = ${data.email.trim() || portfolio.email},
          logo_src = ${data.logo_src === undefined ? portfolio.logo_src : data.logo_src}
      where id = ${portfolio.id}
    `;
    const rows = await sql<Portfolio>`select * from portfolios where id = ${portfolio.id}`;
    return asPortfolio(rows[0]!);
  });

export const updateHomeownerProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { displayName: string; phone: string; email: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const profile = await ensureHomeownerProfile(sql, context.userId);
    const display = data.displayName.trim() || profile.display_name;
    await sql`
      update homeowner_profiles
      set display_name = ${display},
          phone = ${data.phone.trim() || null},
          email = ${data.email.trim() || profile.email}
      where user_id = ${context.userId}
    `;
    const rows = await sql<HomeownerProfile>`
      select * from homeowner_profiles where user_id = ${context.userId} limit 1
    `;
    return asHomeownerProfile(rows[0]!);
  });

export const invitePortfolioOwner = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { propertyId: string; email: string; name?: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { portfolio } = await requirePaidPortfolio(sql, context.userId);
    const property = (
      await sql<Property>`
        select p.*
        from properties p
        join portfolio_properties pp on pp.property_id = p.id
        where p.id = ${data.propertyId} and pp.portfolio_id = ${portfolio.id}
        limit 1
      `
    )[0];
    if (!property) throw new Error("Property not found");
    const email = data.email.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Need the owner's email.");
    if (property.homeowner_user_id) {
      const same = property.homeowner_email.trim().toLowerCase() === email;
      if (!same) {
        throw new Error("This house already has an owner. They transfer the record from their login.");
      }
    }
    const name = data.name?.trim() || property.homeowner_name || "Owner";
    await sql`
      update properties
      set homeowner_email = ${email},
          homeowner_name = ${name},
          invite_status = ${property.homeowner_user_id ? "claimed" : "sent"}
      where id = ${property.id}
    `;
    const origin = (process.env.BETTER_AUTH_URL?.trim() || "https://planitservice.com").replace(/\/+$/, "");
    const inviteUrl = `${origin}/invite/${property.invite_token}`;
    const address = `${property.address_line}, ${property.city}, ${property.state} ${property.zip}`;
    let emailed = false;
    try {
      const { deliverManagerInviteEmail } = await import("./mail");
      await deliverManagerInviteEmail({
        to: email,
        name,
        office: portfolio.name,
        address,
        inviteUrl,
      });
      emailed = true;
    } catch (err) {
      console.error("[mail] manager invite failed", err);
    }
    return {
      inviteToken: property.invite_token,
      emailed,
      claimed: Boolean(property.homeowner_user_id),
    };
  });

export const listOfficeTeam = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const { portfolio, role } = await requirePaidPortfolio(sql, context.userId);
    const members = await sql<PortfolioMember>`
      select * from portfolio_members where portfolio_id = ${portfolio.id} order by role, email
    `;
    return {
      role,
      extraSeats: num(portfolio.extra_seats),
      seatCap: 1 + num(portfolio.extra_seats),
      members,
    };
  });

export const addOfficeMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { email: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { portfolio, role } = await requirePaidPortfolio(sql, context.userId);
    if (role !== "owner") throw new Error("Only the office owner can add seats.");
    const email = data.email.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Need a real email");
    const existing = await sql<{ email: string }>`
      select email from portfolio_members where portfolio_id = ${portfolio.id} and lower(email) = ${email} limit 1
    `;
    if (existing[0]) return { ok: true as const, already: true as const, needSeat: false as const };
    const count = await sql<{ c: number }>`
      select count(*)::int as c from portfolio_members where portfolio_id = ${portfolio.id}
    `;
    const cap = 1 + num(portfolio.extra_seats);
    if (num(count[0]?.c) >= cap) {
      return { ok: false as const, already: false as const, needSeat: true as const };
    }
    const userId = await userIdForEmail(sql, email);
    await sql`
      insert into portfolio_members (id, portfolio_id, user_id, email, role)
      values (${crypto.randomUUID()}, ${portfolio.id}, ${userId}, ${email}, ${"staff"})
      on conflict (portfolio_id, email) do update set user_id = coalesce(excluded.user_id, portfolio_members.user_id)
    `;
    return { ok: true as const, already: false as const, needSeat: false as const };
  });



import { getSql } from "@/lib/db";
import type { Company } from "./types";

const HOUSEHOLD_COMPANY = "co_household";

export async function markShopPaid(userId: string, email?: string | null) {
  const sql = await getSql();
  const owned = await sql<Company>`
    select * from companies
    where user_id = ${userId} and id <> ${HOUSEHOLD_COMPANY}
    limit 1
  `;
  if (owned[0]) {
    await sql`
      update companies
      set shop_paid_at = coalesce(shop_paid_at, now())
      where id = ${owned[0].id}
    `;
    return owned[0].id;
  }
  const member = await sql<Company>`
    select c.*
    from company_members m
    join companies c on c.id = m.company_id
    where m.user_id = ${userId} and c.id <> ${HOUSEHOLD_COMPANY}
    limit 1
  `;
  if (member[0]) {
    await sql`
      update companies
      set shop_paid_at = coalesce(shop_paid_at, now())
      where id = ${member[0].id}
    `;
    return member[0].id;
  }
  const id = crypto.randomUUID();
  const local = email?.split("@")[0]?.replace(/[._]/g, " ") ?? "My shop";
  const name = local.replace(/\b\w/g, (c) => c.toUpperCase()) || "My shop";
  const mail = email?.trim().toLowerCase() || null;
  await sql`
    insert into companies (id, user_id, name, trade, email, shop_paid_at)
    values (${id}, ${userId}, ${name}, ${"general"}, ${mail}, now())
  `;
  await sql`
    insert into company_members (id, company_id, user_id, email, role)
    values (
      ${crypto.randomUUID()}, ${id}, ${userId},
      ${mail || `owner-${id}@local`}, ${"owner"}
    )
    on conflict (company_id, email) do nothing
  `;
  return id;
}

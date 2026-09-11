import { getStripe } from "@/lib/housefile/stripe-client.server";

const HOUSEHOLD_COMPANY = "co_household";

export async function markShopPaid(userId: string, email?: string | null, shopName?: string | null) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const owned = await sql<{ id: string }>`
    select id from companies
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
  const member = await sql<{ id: string }>`
    select c.id
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
  const local = shopName?.trim() || email?.split("@")[0]?.replace(/[._]/g, " ") || "My shop";
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

function shopEmailFromSession(session: {
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
}) {
  return (session.customer_details?.email ?? session.customer_email ?? "").trim().toLowerCase();
}

export async function readPaidShopSession(sessionId: string) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const kind = session.metadata?.kind ?? "";
  const paid =
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required" ||
    session.status === "complete";
  if (!paid || (kind !== "shop_monthly" && kind !== "shop_annual")) {
    return { ok: false as const };
  }
  const email = shopEmailFromSession(session);
  if (!email) return { ok: false as const };
  return {
    ok: true as const,
    email,
    userId: session.metadata?.userId?.trim() || "",
    shopName: session.metadata?.shopName?.trim() || "",
  };
}

export async function claimPaidShopSession(input: {
  sessionId: string;
  password: string;
  name?: string;
}) {
  const paid = await readPaidShopSession(input.sessionId);
  if (!paid.ok) throw new Error("Checkout did not finish. Open a shop to try again.");
  if (input.password.trim().length < 8) throw new Error("Password must be at least 8 characters.");

  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const existing = await sql<{ id: string }>`
    select id from "user" where lower(email) = ${paid.email} limit 1
  `;
  if (existing[0]) {
    throw new Error("That email already has an account. Sign in, then open a shop from the explainer.");
  }

  const { auth } = await import("@/lib/auth/server");
  const name =
    input.name?.trim() || paid.shopName || paid.email.split("@")[0] || "Shop owner";
  const signed = await auth.api.signUpEmail({
    body: { email: paid.email, password: input.password, name },
  });
  const userId = signed.user.id;
  await markShopPaid(userId, paid.email, paid.shopName || name);
  return { ok: true as const, email: paid.email };
}

export async function confirmPaidShopSession(input: { sessionId: string; userId: string }) {
  const paid = await readPaidShopSession(input.sessionId);
  if (!paid.ok) return { ok: false as const };
  if (paid.userId && paid.userId !== input.userId) {
    throw new Error("That checkout belongs to another account.");
  }
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  const session = await getSessionUser();
  await markShopPaid(input.userId, session?.email ?? paid.email, paid.shopName);
  return { ok: true as const };
}

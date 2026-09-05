import Stripe from "stripe";
import type { CheckoutKind } from "@/lib/housefile/stripe";

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}. Set it in Netlify environment variables.`);
  return v;
}

export function getStripe(): Stripe {
  // apiVersion pinned by the installed `stripe` package types
  return new Stripe(requireEnv("STRIPE_SECRET_KEY"));
}

/** Map plan kind -> Stripe Price id (Dashboard → Product → Price). */
export function priceIdFor(kind: CheckoutKind): string {
  // Live catalog defaults (override with env for test mode or new prices)
  const map: Record<CheckoutKind, string> = {
    standard_monthly:
      process.env.STRIPE_PRICE_STANDARD_MONTHLY?.trim() || "price_1U84eaA3tQnfBXBTvY1wUgHn",
    standard_annual:
      process.env.STRIPE_PRICE_STANDARD_ANNUAL?.trim() || "price_1U84fYA3tQnfBXBTe0TgpXgd",
    pro_monthly:
      process.env.STRIPE_PRICE_PRO_MONTHLY?.trim() || "price_1U84jMA3tQnfBXBTngBaqlfo",
    pro_annual:
      process.env.STRIPE_PRICE_PRO_ANNUAL?.trim() || "price_1U84k4A3tQnfBXBT8kRJMgGH",
    shop_monthly:
      process.env.STRIPE_PRICE_SHOP_MONTHLY?.trim() || "price_1U84ntA3tQnfBXBTLOOhheMh",
    shop_annual:
      process.env.STRIPE_PRICE_SHOP_ANNUAL?.trim() || "price_1U84obA3tQnfBXBTHrOLzQ6m",
    seat_monthly:
      process.env.STRIPE_PRICE_SEAT_MONTHLY?.trim() || "price_1U84pZA3tQnfBXBT68DvtKj0",
  };
  const id = map[kind]?.trim();
  if (!id) {
    throw new Error(
      `No Stripe price configured for ${kind}. Set STRIPE_PRICE_* in Netlify (see stripe.server.ts).`,
    );
  }
  return id;
}

function appOrigin(): string {
  return (
    process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ||
    process.env.URL?.replace(/\/$/, "") ||
    process.env.DEPLOY_PRIME_URL?.replace(/\/$/, "") ||
    "http://localhost:8080"
  );
}

export async function createCheckoutSessionUrl(input: {
  kind: CheckoutKind;
  customerEmail?: string | null;
  userId: string;
  propertyId?: string;
  successPath: string;
  cancelPath: string;
}): Promise<string> {
  const stripe = getStripe();
  const price = priceIdFor(input.kind);
  const origin = appOrigin();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    success_url: `${origin}${input.successPath}${input.successPath.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${input.cancelPath}`,
    customer_email: input.customerEmail || undefined,
    client_reference_id: input.userId,
    metadata: {
      userId: input.userId,
      kind: input.kind,
      propertyId: input.propertyId ?? "",
    },
    subscription_data: {
      metadata: {
        userId: input.userId,
        kind: input.kind,
        propertyId: input.propertyId ?? "",
      },
    },
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return session.url;
}

export async function createPortalSessionUrl(input: {
  customerId?: string | null;
  customerEmail?: string | null;
  returnPath: string;
}): Promise<string> {
  const stripe = getStripe();
  const origin = appOrigin();
  let customerId = input.customerId ?? undefined;

  if (!customerId && input.customerEmail) {
    const found = await stripe.customers.list({ email: input.customerEmail, limit: 1 });
    customerId = found.data[0]?.id;
  }
  if (!customerId) {
    throw new Error(
      "No Stripe customer found for this account yet. Complete a checkout first, or use the email from your Stripe receipt.",
    );
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}${input.returnPath}`,
  });
  return portal.url;
}

const HOUSEHOLD_COMPANY = "co_household";

export async function markShopPaid(userId: string, email?: string | null) {
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

export async function confirmPaidShopSession(input: { sessionId: string; userId: string }) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(input.sessionId);
  if (session.payment_status !== "paid" && session.status !== "complete") {
    return { ok: false as const };
  }
  if (session.metadata?.userId !== input.userId) {
    throw new Error("That checkout belongs to another account.");
  }
  const kind = session.metadata?.kind ?? "";
  if (kind !== "shop_monthly" && kind !== "shop_annual") {
    return { ok: false as const };
  }
  await markShopPaid(
    input.userId,
    session.customer_details?.email ?? session.customer_email ?? null,
  );
  return { ok: true as const };
}

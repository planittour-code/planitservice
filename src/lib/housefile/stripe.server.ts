import type { CheckoutKind } from "@/lib/housefile/stripe";
import { getStripe, stripeIsTest } from "@/lib/housefile/stripe-client.server";
import {
  clearPortfolioSubscription,
  markPortfolioPaid,
  syncPortfolioSubscription,
} from "@/lib/housefile/portfolio-entitlement.server";
import {
  claimPaidShopSession,
  confirmPaidShopSession,
  markShopPaid,
  readPaidShopSession,
} from "@/lib/housefile/stripe-shop.server";
import { MANAGE_TRIAL_DAYS } from "@/lib/housefile/pricing";

export { getStripe, stripeIsTest } from "@/lib/housefile/stripe-client.server";
export {
  clearPortfolioSubscription,
  markPortfolioPaid,
  syncPortfolioSubscription,
} from "@/lib/housefile/portfolio-entitlement.server";
export {
  claimPaidShopSession,
  confirmPaidShopSession,
  markShopPaid,
  readPaidShopSession,
} from "@/lib/housefile/stripe-shop.server";

/** Live catalog. Used only with sk_live. Test mode must set STRIPE_PRICE_* env. */
const LIVE_PRICES: Record<CheckoutKind, string> = {
  standard_monthly: "price_1U84eaA3tQnfBXBTvY1wUgHn",
  standard_annual: "price_1U84fYA3tQnfBXBTe0TgpXgd",
  pro_monthly: "price_1U84jMA3tQnfBXBTngBaqlfo",
  pro_annual: "price_1U84k4A3tQnfBXBT8kRJMgGH",
  shop_monthly: "price_1U84ntA3tQnfBXBTLOOhheMh",
  shop_annual: "price_1U84obA3tQnfBXBTHrOLzQ6m",
  seat_monthly: "price_1U84pZA3tQnfBXBT68DvtKj0",
  manage_monthly: "price_1UDW4FPNiO3QnmB4qD1pdm0x",
  manage_annual: "price_1UDW5NPNiO3QnmB4d6Ze4U59",
  manage_extra_monthly: "price_1UDW7cPNiO3QnmB4sTmTb7lp",
  manage_extra_annual: "price_1UDW8FPNiO3QnmB4NRMYNdI4",
  manage_seat_monthly: "price_1U8nJaPNiO3QnmB44sb5Hjm8",
  manage_seat_annual: "price_1UDqhQPNiO3QnmB4x9l2XbPr",
};

const PRICE_ENV: Record<CheckoutKind, string> = {
  standard_monthly: "STRIPE_PRICE_STANDARD_MONTHLY",
  standard_annual: "STRIPE_PRICE_STANDARD_ANNUAL",
  pro_monthly: "STRIPE_PRICE_PRO_MONTHLY",
  pro_annual: "STRIPE_PRICE_PRO_ANNUAL",
  shop_monthly: "STRIPE_PRICE_SHOP_MONTHLY",
  shop_annual: "STRIPE_PRICE_SHOP_ANNUAL",
  seat_monthly: "STRIPE_PRICE_SEAT_MONTHLY",
  manage_monthly: "STRIPE_PRICE_MANAGE_MONTHLY",
  manage_annual: "STRIPE_PRICE_MANAGE_ANNUAL",
  manage_extra_monthly: "STRIPE_PRICE_MANAGE_EXTRA_MONTHLY",
  manage_extra_annual: "STRIPE_PRICE_MANAGE_EXTRA_ANNUAL",
  manage_seat_monthly: "STRIPE_PRICE_MANAGE_SEAT_MONTHLY",
  manage_seat_annual: "STRIPE_PRICE_MANAGE_SEAT_ANNUAL",
};

/** Map plan kind -> Stripe Price id (Dashboard → Product → Price). */
export function priceIdFor(kind: CheckoutKind): string {
  const fromEnv = process.env[PRICE_ENV[kind]]?.trim() || "";
  if (fromEnv) return fromEnv;
  if (stripeIsTest()) {
    throw new Error(
      `No Stripe test price for ${kind}. Run node scripts/stripe-test-catalog.mjs with sk_test, then set ${PRICE_ENV[kind]}.`,
    );
  }
  const id = LIVE_PRICES[kind]?.trim();
  if (!id) {
    throw new Error(
      `No Stripe price configured for ${kind}. Set ${PRICE_ENV[kind]} in Netlify (see stripe.server.ts).`,
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

function isManageBaseKind(kind: CheckoutKind): boolean {
  return kind === "manage_monthly" || kind === "manage_annual";
}

export async function createCheckoutSessionUrl(input: {
  kind: CheckoutKind;
  customerEmail?: string | null;
  userId?: string;
  shopName?: string;
  officeName?: string;
  propertyId?: string;
  quantity?: number;
  successPath: string;
  cancelPath: string;
}): Promise<string> {
  const stripe = getStripe();
  const price = priceIdFor(input.kind);
  const origin = appOrigin();
  const metadata = {
    userId: input.userId ?? "",
    kind: input.kind,
    propertyId: input.propertyId ?? "",
    shopName: input.shopName ?? "",
    officeName: input.officeName ?? "",
  };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: input.quantity && input.quantity > 1 ? input.quantity : 1 }],
    success_url: `${origin}${input.successPath}${input.successPath.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${input.cancelPath}`,
    allow_promotion_codes: true,
    // 100% staff coupons can complete without a card; paid checkouts still require one.
    payment_method_collection: "if_required",
    customer_email: input.customerEmail || undefined,
    client_reference_id: input.userId || undefined,
    metadata,
    subscription_data: {
      metadata,
      ...(isManageBaseKind(input.kind) ? { trial_period_days: MANAGE_TRIAL_DAYS } : {}),
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
  let customerId = input.customerId?.trim() || undefined;

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

function shopEmailFromSession(session: {
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
}) {
  return (session.customer_details?.email ?? session.customer_email ?? "").trim().toLowerCase();
}

export async function readPaidManageSession(sessionId: string) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const kind = session.metadata?.kind ?? "";
  const paid =
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required" ||
    session.status === "complete";
  const base = kind === "manage_monthly" || kind === "manage_annual";
  const extra = kind === "manage_extra_monthly" || kind === "manage_extra_annual";
  const seat = kind === "manage_seat_monthly" || kind === "manage_seat_annual";
  if (!paid || (!base && !extra && !seat)) {
    return { ok: false as const };
  }
  const email = shopEmailFromSession(session);
  if (!email) return { ok: false as const };
  let quantity = 1;
  if (extra || seat) {
    const full = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
    quantity = full.line_items?.data[0]?.quantity ?? 1;
  }
  const customerId = typeof session.customer === "string" ? session.customer : null;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
  return {
    ok: true as const,
    email,
    userId: session.metadata?.userId?.trim() || "",
    officeName: session.metadata?.officeName?.trim() || "",
    extra,
    seat,
    quantity,
    customerId,
    subscriptionId,
  };
}

export async function claimPaidManageSession(input: {
  sessionId: string;
  password: string;
  name?: string;
}) {
  const paid = await readPaidManageSession(input.sessionId);
  if (!paid.ok) throw new Error("Checkout did not finish. Open a portfolio to try again.");
  if (paid.extra) throw new Error("Sign in, then add extra houses from the portfolio.");
  if (paid.seat) throw new Error("Sign in, then add office seats from Office settings.");
  if (input.password.trim().length < 8) throw new Error("Password must be at least 8 characters.");

  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const existing = await sql<{ id: string }>`
    select id from "user" where lower(email) = ${paid.email} limit 1
  `;
  if (existing[0]) {
    throw new Error("That email already has an account. Sign in, then open a portfolio from the explainer.");
  }

  const { auth } = await import("@/lib/auth/server");
  const name =
    input.name?.trim() || paid.officeName || paid.email.split("@")[0] || "Property manager";
  const signed = await auth.api.signUpEmail({
    body: { email: paid.email, password: input.password, name },
  });
  const userId = signed.user.id;
  await markPortfolioPaid(userId, paid.email, paid.officeName || name, {
    customerId: paid.customerId,
    subscriptionId: paid.subscriptionId,
  });
  return { ok: true as const, email: paid.email };
}

export async function grantManageExtraSlots(input: {
  userId: string;
  sessionId: string;
  quantity: number;
}) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ id: string; paid_at: Date | string | null }>`
    select id, paid_at from portfolios where user_id = ${input.userId} limit 1
  `;
  const portfolioId = rows[0]?.id;
  if (!portfolioId) throw new Error("Open a portfolio before adding extra houses.");
  if (!rows[0]?.paid_at) {
    throw new Error("Portfolio must be active or on trial before adding extra houses.");
  }
  const recorded = await sql<{ session_id: string }>`
    insert into portfolio_billing_events (session_id, portfolio_id, kind, quantity)
    values (${input.sessionId}, ${portfolioId}, ${"manage_extra"}, ${input.quantity})
    on conflict (session_id) do nothing
    returning session_id
  `;
  if (recorded[0]) {
    await sql`
      update portfolios
      set extra_slots = extra_slots + ${input.quantity},
          paid_at = coalesce(paid_at, now())
      where id = ${portfolioId}
    `;
  }
}

export async function grantManageExtraSeats(input: {
  userId: string;
  sessionId: string;
  quantity: number;
}) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ id: string; paid_at: Date | string | null }>`
    select id, paid_at from portfolios where user_id = ${input.userId} limit 1
  `;
  const portfolioId = rows[0]?.id;
  if (!portfolioId) throw new Error("Open a portfolio before adding office seats.");
  if (!rows[0]?.paid_at) {
    throw new Error("Portfolio must be active or on trial before adding office seats.");
  }
  const recorded = await sql<{ session_id: string }>`
    insert into portfolio_billing_events (session_id, portfolio_id, kind, quantity)
    values (${input.sessionId}, ${portfolioId}, ${"manage_seat"}, ${input.quantity})
    on conflict (session_id) do nothing
    returning session_id
  `;
  if (recorded[0]) {
    await sql`
      update portfolios
      set extra_seats = extra_seats + ${input.quantity},
          paid_at = coalesce(paid_at, now())
      where id = ${portfolioId}
    `;
  }
}

export async function confirmPaidManageSession(input: { sessionId: string; userId: string }) {
  const paid = await readPaidManageSession(input.sessionId);
  if (!paid.ok) return { ok: false as const };
  if (paid.userId && paid.userId !== input.userId) {
    throw new Error("That checkout belongs to another account.");
  }
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  const session = await getSessionUser();
  if (paid.seat) {
    await grantManageExtraSeats({
      userId: input.userId,
      sessionId: input.sessionId,
      quantity: paid.quantity,
    });
    return { ok: true as const };
  }
  if (paid.extra) {
    await grantManageExtraSlots({
      userId: input.userId,
      sessionId: input.sessionId,
      quantity: paid.quantity,
    });
    return { ok: true as const, extra: true as const };
  }
  await markPortfolioPaid(input.userId, session?.email ?? paid.email, paid.officeName, {
    customerId: paid.customerId,
    subscriptionId: paid.subscriptionId,
  });
  return { ok: true as const, extra: false as const };
}

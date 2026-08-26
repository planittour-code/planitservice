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
  const map: Record<CheckoutKind, string> = {
    standard_monthly: process.env.STRIPE_PRICE_STANDARD_MONTHLY ?? "",
    standard_annual: process.env.STRIPE_PRICE_STANDARD_ANNUAL ?? "",
    pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
    pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL ?? "",
    shop_monthly: process.env.STRIPE_PRICE_SHOP_MONTHLY ?? "",
    shop_annual: process.env.STRIPE_PRICE_SHOP_ANNUAL ?? "",
    seat_monthly: process.env.STRIPE_PRICE_SEAT_MONTHLY ?? "",
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

/** Stripe plan catalog. Price IDs come from env (server). Payment Links retired. */

export type HomeownerTier = "standard" | "pro";
export type Cadence = "monthly" | "annual";
export type CheckoutKind =
  | "standard_monthly"
  | "standard_annual"
  | "pro_monthly"
  | "pro_annual"
  | "shop_monthly"
  | "shop_annual"
  | "seat_monthly";

export function homeownerKind(tier: HomeownerTier, cadence: Cadence): CheckoutKind {
  if (tier === "pro") return cadence === "annual" ? "pro_annual" : "pro_monthly";
  return cadence === "annual" ? "standard_annual" : "standard_monthly";
}

export function shopKind(cadence: Cadence): CheckoutKind {
  return cadence === "annual" ? "shop_annual" : "shop_monthly";
}

/** Stripe Customer Portal login — cancel, cards, invoices. */
export const BILLING_PORTAL = "https://billing.stripe.com/p/login/4gM00icax759aAq3uY8AE00";

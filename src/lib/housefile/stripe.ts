/** Public Stripe Payment Links. Not secrets. */
export const STRIPE = {
  standardMonthly: "https://buy.stripe.com/bJefZgfmJ3SX8si0iM8AE0b",
  standardAnnual: "https://buy.stripe.com/3cI9AS2zXexB9wm4z28AE0a",
  proMonthly: "https://buy.stripe.com/8x200i6Qddtx7oee9C8AE09",
  proAnnual: "https://buy.stripe.com/3cI9AS4I5dtx5g64z28AE08",
  shopMonthly: "https://buy.stripe.com/dRm5kCa2p2OTgYOghK8AE07",
  shopAnnual: "https://buy.stripe.com/dRm14m7Uh4X137YfdG8AE06",
  seatMonthly: "https://buy.stripe.com/7sYcN4b6tdtxdMC3uY8AE05",
  /** Stripe Customer Portal — cancel, update card, invoices */
  billingPortal: "https://billing.stripe.com/p/login/4gM00icax759aAq3uY8AE00",
} as const;

export function homeownerCheckout(tier: "standard" | "pro", cadence: "monthly" | "annual") {
  if (tier === "pro") return cadence === "annual" ? STRIPE.proAnnual : STRIPE.proMonthly;
  return cadence === "annual" ? STRIPE.standardAnnual : STRIPE.standardMonthly;
}

export function shopCheckout(cadence: "monthly" | "annual") {
  return cadence === "annual" ? STRIPE.shopAnnual : STRIPE.shopMonthly;
}

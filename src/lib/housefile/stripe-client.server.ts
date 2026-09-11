import Stripe from "stripe";

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}. Set it in Netlify environment variables.`);
  return v;
}

function stripeSecret(): string {
  return requireEnv("STRIPE_SECRET_KEY");
}

export function getStripe(): Stripe {
  const key = stripeSecret();
  if (process.env.NETLIFY === "true" && key.startsWith("sk_test_")) {
    throw new Error("Stripe test keys are not allowed on Netlify. Production uses live keys.");
  }
  return new Stripe(key);
}

export function stripeIsTest(): boolean {
  return stripeSecret().startsWith("sk_test_");
}

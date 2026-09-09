/**
 * Create Stripe TEST products/prices that match the live PlanitService catalog.
 *
 * Usage (PowerShell):
 *   $env:STRIPE_SECRET_KEY = "sk_test_..."
 *   node scripts/stripe-test-catalog.mjs
 *
 * Paste the printed block into a gitignored .env.local. Leave DATABASE_URL
 * unset so local npm run dev uses PGLite, not live Supabase.
 *
 * Never run this with sk_live. Never put sk_test on Netlify production.
 */
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY?.trim() || "";
if (!key.startsWith("sk_test_")) {
  console.error("Set STRIPE_SECRET_KEY to a sk_test_ key. Refusing live keys.");
  process.exit(1);
}

const stripe = new Stripe(key);

const catalog = [
  { env: "STRIPE_PRICE_STANDARD_MONTHLY", name: "PlanitService — Homeowner Standard — Monthly (TEST)", cents: 799, interval: "month" },
  { env: "STRIPE_PRICE_STANDARD_ANNUAL", name: "PlanitService — Homeowner Standard — Annual (TEST)", cents: 7999, interval: "year" },
  { env: "STRIPE_PRICE_PRO_MONTHLY", name: "PlanitService — Homeowner Pro — Monthly (TEST)", cents: 999, interval: "month" },
  { env: "STRIPE_PRICE_PRO_ANNUAL", name: "PlanitService — Homeowner Pro — Annual (TEST)", cents: 9900, interval: "year" },
  { env: "STRIPE_PRICE_SHOP_MONTHLY", name: "PlanitService — Shop — Monthly (TEST)", cents: 999, interval: "month" },
  { env: "STRIPE_PRICE_SHOP_ANNUAL", name: "PlanitService — Shop — Annual (TEST)", cents: 9900, interval: "year" },
  { env: "STRIPE_PRICE_SEAT_MONTHLY", name: "PlanitService — Extra shop seat — Monthly (TEST)", cents: 500, interval: "month" },
  { env: "STRIPE_PRICE_MANAGE_MONTHLY", name: "PlanitService — Property Manager — Monthly (TEST)", cents: 3999, interval: "month" },
  { env: "STRIPE_PRICE_MANAGE_ANNUAL", name: "PlanitService — Property Manager — Annual (TEST)", cents: 39900, interval: "year" },
  { env: "STRIPE_PRICE_MANAGE_EXTRA_MONTHLY", name: "PlanitService — Extra PM house — Monthly (TEST)", cents: 399, interval: "month" },
  { env: "STRIPE_PRICE_MANAGE_EXTRA_ANNUAL", name: "PlanitService — Extra PM house — Annual (TEST)", cents: 3999, interval: "year" },
  { env: "STRIPE_PRICE_MANAGE_SEAT_MONTHLY", name: "PlanitService — Extra PM office seat — Monthly (TEST)", cents: 500, interval: "month" },
  { env: "STRIPE_PRICE_MANAGE_SEAT_ANNUAL", name: "PlanitService — Extra PM office seat — Annual (TEST)", cents: 5000, interval: "year" },
];

const lines = ["STRIPE_SECRET_KEY=" + key];

for (const item of catalog) {
  const existing = await stripe.products.search({
    query: `name:'${item.name.replaceAll("'", "\\'")}' AND active:'true'`,
    limit: 1,
  });
  let product = existing.data[0];
  if (!product) {
    product = await stripe.products.create({ name: item.name });
  }
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
  let price = prices.data.find(
    (p) => p.unit_amount === item.cents && p.recurring?.interval === item.interval,
  );
  if (!price) {
    price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: item.cents,
      recurring: { interval: item.interval },
    });
  }
  lines.push(`${item.env}=${price.id}`);
  console.error(`${item.env}  ${price.id}  ${item.name}`);
}

console.log("");
console.log("# gitignored local test env — do not commit, do not put on Netlify");
console.log(lines.join("\n"));
console.log("STRIPE_WEBHOOK_SECRET=whsec_replace_me");

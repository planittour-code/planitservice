import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const payment = readFileSync(join(root, "src/lib/housefile/payment.ts"), "utf8");
const invoice = readFileSync(join(root, "src/lib/housefile/invoice.ts"), "utf8");

// Mirrors paymentSchedule/checkoutAmount in src/lib/housefile/payment.ts.
function depositPercent(raw) {
  if (!raw || raw === "due_completion") return 0;
  if (raw === "split_50") return 50;
  if (raw === "upfront_100") return 100;
  const m = String(raw).match(/\d+(\.\d+)?/);
  return m ? Math.min(100, Math.max(0, Number(m[0]))) : 0;
}
function checkoutAmount(total, terms) {
  const due = depositPercent(terms);
  const amount = due <= 0 || due >= 100 ? total : Math.round(total * due) / 100;
  return Math.round(amount * 100) / 100;
}

test("no card fee is added to the checkout amount for any shop", () => {
  assert.doesNotMatch(payment, /CARD_FEE_RATE|withCardFee/);
  assert.match(payment, /return Math\.round\(due \* 100\) \/ 100;/);
  assert.equal(checkoutAmount(1000, "due_completion"), 1000);
  assert.equal(checkoutAmount(1000, "split_50"), 500);
  assert.equal(checkoutAmount(1234.56, "upfront_100"), 1234.56);
});

test("invoice payment copy is neutral and fee-free", () => {
  assert.doesNotMatch(invoice, /card fee|3%|Payment Portal/i);
  assert.match(invoice, /Pay \$\{input\.companyName\} online with the link below\. Payment goes directly to \$\{input\.companyName\}\./);
  assert.match(invoice, /Ask the shop how they take payment\./);
});

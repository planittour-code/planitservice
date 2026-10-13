import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("estimate email copy lives in a shared helper", () => {
  const src = readFileSync(join(root, "src/lib/housefile/estimate-email.ts"), "utf8");
  assert.match(src, /export function estimateEmailCopy/);
  assert.match(src, /Same letter the customer receives/);
  assert.match(src, /Open the estimate/);
  assert.match(src, /Property Record/);
  assert.match(src, /Total /);
});

test("proposal doc previews that letter next to send", () => {
  const doc = readFileSync(join(root, "src/components/proposal-doc.tsx"), "utf8");
  const proposalDoc = doc.slice(doc.indexOf("export function ProposalDoc"), doc.indexOf("function estimateHeroSrc"));
  assert.match(doc, /function ContractorNotesAndSend/);
  assert.match(doc, /function CustomerEmailPreview/);
  assert.match(doc, /Preview as it appears in email/);
  assert.match(doc, /Send this estimate to/);
  assert.match(proposalDoc, /<ContractorNotesAndSend/);
  assert.doesNotMatch(proposalDoc, /<SendEstimateBar/);
});

test("mailer uses the shared estimate letter", () => {
  const mailer = readFileSync(join(root, "src/lib/auth/mail.server.ts"), "utf8");
  const deliver = readFileSync(join(root, "src/lib/housefile/mail.ts"), "utf8");
  assert.match(mailer, /estimateEmailCopy/);
  assert.match(deliver, /items: input.items/);
  assert.match(deliver, /coverNote: input.proposal.cover_note/);
  assert.match(deliver, /kind.*estimate/);
});

test("shop review reads customer letter status from Resend", () => {
  const server = readFileSync(join(root, "src/lib/housefile/server.ts"), "utf8");
  const mailer = readFileSync(join(root, "src/lib/auth/mail.server.ts"), "utf8");
  const webhook = readFileSync(join(root, "server/middleware/resend-webhook.ts"), "utf8");
  assert.match(server, /syncProposalDeliveryFromResend/);
  assert.match(mailer, /findCustomerEstimateEmail/);
  assert.match(webhook, /isShopReviewCopy/);
});

import { money } from "./format";
import { acceptedEstimatePdf } from "./estimate-pdf";
import {
  checkoutAmount,
  customerCode,
  mxPaymentUrl,
  normalizePaymentLink,
  paymentInvoiceNumber,
  paymentSchedule,
  paymentTermLabel,
} from "./payment";
import type { Company, InvoiceSalesRep, Property, Proposal, ProposalItem } from "./types";

function publicUrl(path: string) {
  const origin = (process.env.BETTER_AUTH_URL?.trim() || "https://planitservice.com").replace(/\/+$/, "");
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function deliverSalesWelcomeEmail(input: {
  to: string;
  shopName: string;
}) {
  const { sendSalesWelcomeEmail } = await import("@/lib/auth/mail.server");
  await sendSalesWelcomeEmail({
    to: input.to,
    shopName: input.shopName,
    loginUrl: publicUrl(`/login?email=${encodeURIComponent(input.to)}&next=/app&role=contractor`),
  });
}

export type EstimateSendResult = {
  to: string;
  subject: string;
  html: string;
  text: string;
  resendId: string | null;
};

/** Server-only. Import dynamically from createServerFn handlers, never from route modules. */
export async function deliverEstimateEmail(input: {
  property: Property;
  proposal: Proposal;
  company: Pick<Company, "name" | "email" | "terms">;
  items: ProposalItem[];
  salesReps?: InvoiceSalesRep[];
  idempotencyKey?: string;
}): Promise<EstimateSendResult> {
  const { sendEstimateEmail } = await import("@/lib/auth/mail.server");
  const to = input.property.homeowner_email;
  const sent = await sendEstimateEmail({
    to,
    name: input.property.homeowner_name,
    company: input.company.name,
    address: `${input.property.address_line}, ${input.property.city}, ${input.property.state} ${input.property.zip}`,
    proposalUrl: publicUrl(`/p/${input.proposal.share_token}`),
    inviteUrl: publicUrl(`/invite/${input.property.invite_token}`),
    replyToken: input.proposal.share_token,
    title: input.proposal.title,
    coverNote: input.proposal.cover_note,
    terms: input.company.terms,
    items: input.items,
    salesReps: input.salesReps,
    tags: [
      { name: "kind", value: "estimate" },
      { name: "proposal_id", value: input.proposal.id },
    ],
    idempotencyKey: input.idempotencyKey,
  });
  return { to, subject: sent.subject, html: sent.html, text: sent.text, resendId: sent.resendId };
}

export async function deliverManagerInviteEmail(input: {
  to: string;
  name: string;
  office: string;
  address: string;
  inviteUrl: string;
}) {
  const { sendManagerInviteEmail } = await import("@/lib/auth/mail.server");
  await sendManagerInviteEmail(input);
}

export async function deliverRepeatServiceEmail(input: {
  to: string;
  name: string;
  company: string;
  address: string;
  lastWork: string;
  repeatWork: string;
  extraWork: string[];
  note: string;
  fileUrl: string;
  homeUrl: string;
  projectUrl?: string;
}) {
  const { sendRepeatServiceEmail } = await import("@/lib/auth/mail.server");
  await sendRepeatServiceEmail(input);
}

export async function deliverNamedShopInviteEmail(input: {
  to: string;
  shopName?: string;
  fromName: string;
  address: string;
  title: string;
  body: string;
  quoteUrl: string;
  houseUrl: string;
}) {
  const { sendNamedShopInviteEmail } = await import("@/lib/auth/mail.server");
  await sendNamedShopInviteEmail(input);
}

export async function deliverEstimateReviewEmail(input: {
  to: string;
  name: string;
  who: string;
  address: string;
  title: string;
  reason: string;
  proposalUrl: string;
}) {
  const { sendEstimateReviewEmail } = await import("@/lib/auth/mail.server");
  await sendEstimateReviewEmail(input);
}

export async function deliverServiceDateEmail(input: {
  to: string;
  name: string;
  company: string;
  address: string;
  title: string;
  serviceDate: string;
  serviceDay: string;
  note: string;
  replyTo?: string | null;
  eventUid: string;
}) {
  const { sendServiceDateEmail } = await import("@/lib/auth/mail.server");
  await sendServiceDateEmail(input);
}

export async function deliverTransferConfirmEmail(input: {
  to: string;
  name: string;
  address: string;
  toEmail: string;
  confirmUrl: string;
  code: string;
}) {
  const { sendTransferConfirmEmail } = await import("@/lib/auth/mail.server");
  await sendTransferConfirmEmail(input);
}

export async function deliverTransferClaimEmail(input: {
  to: string;
  address: string;
  fromName: string;
  claimUrl: string;
}) {
  const { sendTransferClaimEmail } = await import("@/lib/auth/mail.server");
  await sendTransferClaimEmail(input);
}

export async function deliverAcceptedEstimateEmail(input: {
  property: Property;
  proposal: Proposal;
  company: Company;
  items: ProposalItem[];
  salesRep?: { name: string; email: string } | null;
  salesReps?: { name: string; email: string }[];
}) {
  const { sendAcceptedEstimateEmail } = await import("@/lib/auth/mail.server");
  const pdf = await acceptedEstimatePdf({
    company: input.company,
    property: input.property,
    proposal: input.proposal,
    items: input.items,
    salesRep: input.salesRep ?? null,
    salesReps: input.salesReps,
  });
  const total = input.items.filter((i) => i.included).reduce((sum, i) => sum + i.qty * i.unit_price, 0);
  await sendAcceptedEstimateEmail({
    to: input.property.homeowner_email,
    name: input.property.homeowner_name,
    company: input.company.name,
    address: `${input.property.address_line}, ${input.property.city}, ${input.property.state} ${input.property.zip}`,
    total: money(total),
    paymentTerms: paymentTermLabel(input.company.payment_terms),
    schedule: paymentSchedule(total, input.company.payment_terms).map(
      (row) => `${row.label}: ${money(row.amount)}`,
    ),
    paymentLink: mxPaymentUrl(normalizePaymentLink(input.proposal.payment_link || input.company.payment_link), {
      amount: checkoutAmount(total, input.company.payment_terms),
      invoiceNumber: paymentInvoiceNumber(input.proposal.id),
      customerCode: customerCode(input.property.invite_token),
      name: input.property.homeowner_name,
      email: input.property.homeowner_email,
      phone: input.property.homeowner_phone,
      address: input.property.address_line,
      city: input.property.city,
      state: input.property.state,
      zip: input.property.zip,
    }),
    proposalUrl: publicUrl(`/p/${input.proposal.share_token}/accepted`),
    pdf,
  });
}

/**
 * Work order assignment (AC 4.3a). Rendered by work-orders.ts with no prices
 * and no homeowner contact info; sent from the shop's normal sender with
 * replies going to the shop.
 */
export async function deliverWorkOrderAssignmentEmail(input: {
  to: string;
  shopName: string;
  shopReplyTo: string | null;
  workOrderId: string;
  subject: string;
  text: string;
  html: string;
}) {
  const { sendWorkOrderAssignmentEmail } = await import("@/lib/auth/mail.server");
  await sendWorkOrderAssignmentEmail(input);
}

import { money } from "./format";
import { acceptedEstimatePdf } from "./estimate-pdf";
import { normalizePaymentLink, paymentSchedule, paymentTermLabel } from "./payment";
import type { Company, Property, Proposal, ProposalItem } from "./types";

function publicUrl(path: string) {
  const origin = (process.env.BETTER_AUTH_URL?.trim() || "https://planitservice.com").replace(/\/+$/, "");
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Server-only. Import dynamically from createServerFn handlers, never from route modules. */
export async function deliverEstimateEmail(input: {
  property: Property;
  proposal: Proposal;
  company: Pick<Company, "name" | "email">;
}) {
  const { sendEstimateEmail } = await import("@/lib/auth/mail.server");
  await sendEstimateEmail({
    to: input.property.homeowner_email,
    name: input.property.homeowner_name,
    company: input.company.name,
    address: `${input.property.address_line}, ${input.property.city}, ${input.property.state} ${input.property.zip}`,
    proposalUrl: publicUrl(`/p/${input.proposal.share_token}`),
    inviteUrl: publicUrl(`/invite/${input.property.invite_token}`),
    replyToken: input.proposal.share_token,
  });
}

export async function deliverAcceptedEstimateEmail(input: {
  property: Property;
  proposal: Proposal;
  company: Company;
  items: ProposalItem[];
}) {
  const { sendAcceptedEstimateEmail } = await import("@/lib/auth/mail.server");
  const pdf = await acceptedEstimatePdf({
    company: input.company,
    property: input.property,
    proposal: input.proposal,
    items: input.items,
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
    paymentLink: normalizePaymentLink(input.company.payment_link),
    proposalUrl: publicUrl(`/p/${input.proposal.share_token}/accepted`),
    pdf,
  });
}

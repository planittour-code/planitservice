import type { Company, Property, Proposal } from "./types";

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

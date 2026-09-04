import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { LEGAL_EMAIL } from "@/lib/legal";
import { publicUrl } from "./invite";
import type { Company, Property, Proposal } from "./types";

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

async function shopProposal(
  sql: Sql,
  userId: string,
  proposalId: string,
): Promise<{ company: Company; proposal: Proposal; property: Property }> {
  const owned = await sql<Proposal>`
    select pr.*
    from proposals pr
    join companies c on c.id = pr.company_id
    where pr.id = ${proposalId}
      and (
        c.user_id = ${userId}
        or exists (
          select 1 from company_members m
          where m.company_id = c.id and m.user_id = ${userId}
        )
      )
    limit 1
  `;
  const proposal = owned[0];
  if (!proposal) throw new Error("Proposal not found");
  const companies = await sql<Company>`select * from companies where id = ${proposal.company_id} limit 1`;
  const company = companies[0];
  if (!company) throw new Error("Shop not found");
  const property = (await sql<Property>`select * from properties where id = ${proposal.property_id}`)[0];
  if (!property) throw new Error("House not found");
  return { company, proposal, property };
}

export const sendEstimateToHomeowner = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((proposalId: string) => proposalId)
  .handler(async ({ context, data: proposalId }) => {
    const sql = await getSql();
    const { company, proposal, property } = await shopProposal(sql, context.userId, proposalId);
    if (proposal.status === "pending") {
      throw new Error("The owner has to approve this quote before it can go to the homeowner.");
    }
    try {
      await deliverEstimateEmail({ property, proposal, company });
    } catch (err) {
      console.error("[mail] estimate send failed", err);
      throw new Error(`Could not email the estimate. Write ${LEGAL_EMAIL}.`);
    }
    await sql`
      update proposals set status = ${"sent"}, sent_at = coalesce(sent_at, now()) where id = ${proposal.id}
    `;
    await sql`update properties set invite_status = ${"sent"} where id = ${property.id}`;
    return { ok: true as const, emailed: property.homeowner_email };
  });

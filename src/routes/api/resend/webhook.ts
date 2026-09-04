import { createFileRoute } from "@tanstack/react-router";
import {
  fetchReceivedEmail,
  parseEstimateReplyToken,
  stripQuotedReply,
} from "@/lib/auth/mail.server";
import { getSql } from "@/lib/db";
import type { Property, Proposal } from "@/lib/housefile/types";

type ResendEvent = {
  type?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string[];
    received_for?: string[];
    subject?: string;
  };
};

function authorName(from: string | undefined) {
  if (!from) return "Homeowner";
  const named = from.match(/^"?([^"<]+)"?\s*</);
  if (named?.[1]?.trim()) return named[1].trim();
  const email = from.match(/[\w.+-]+@[\w.-]+/);
  return email?.[0] ?? "Homeowner";
}

export const Route = createFileRoute("/api/resend/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        let event: ResendEvent;
        try {
          event = JSON.parse(raw) as ResendEvent;
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }
        if (event.type && event.type !== "email.received") {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        try {
          const emailId = event.data?.email_id;
          const received = emailId
            ? await fetchReceivedEmail(emailId).catch(() => null)
            : null;
          const to = [
            ...(received?.to ?? []),
            ...(received?.received_for ?? []),
            ...(event.data?.to ?? []),
            ...(event.data?.received_for ?? []),
          ];
          const token = parseEstimateReplyToken(to);
          if (!token) {
            return new Response(JSON.stringify({ ok: true, ignored: true }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
          const text = stripQuotedReply(received?.text || received?.html?.replace(/<[^>]+>/g, " ") || "");
          if (!text) {
            return new Response(JSON.stringify({ ok: true, empty: true }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
          const sql = await getSql();
          const rows = await sql<Proposal>`select * from proposals where share_token = ${token} limit 1`;
          const proposal = rows[0];
          if (!proposal) {
            return new Response(JSON.stringify({ ok: true, missing: true }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
          const property = (await sql<Property>`select * from properties where id = ${proposal.property_id}`)[0];
          const name = authorName(received?.from ?? event.data?.from) || property?.homeowner_name || "Homeowner";
          await sql`
            insert into proposal_messages (id, proposal_id, author_role, author_name, body)
            values (${crypto.randomUUID()}, ${proposal.id}, ${"homeowner"}, ${name}, ${text})
          `;
          if (proposal.status === "sent") {
            await sql`update proposals set status = ${"revised"} where id = ${proposal.id}`;
          }
        } catch (err) {
          console.error("[resend] inbound webhook failed", err);
          return new Response("Handler failed", { status: 500 });
        }
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});

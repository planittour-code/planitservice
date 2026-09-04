import type { Property, Proposal } from "../../src/lib/housefile/types";

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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export default async function resendWebhookMiddleware(
  event: { url: URL; req: Request },
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  if (event.url.pathname !== "/api/resend/webhook") return next();

  const method = (event.req.method ?? "GET").toUpperCase();
  if (method === "GET") return json({ ok: true });
  if (method === "HEAD") return new Response(null, { status: 200 });
  if (method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const raw = await event.req.text();
  let parsed: ResendEvent;
  try {
    parsed = JSON.parse(raw) as ResendEvent;
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }
  if (parsed.type && parsed.type !== "email.received") {
    return json({ ok: true });
  }
  try {
    const { fetchReceivedEmail, parseEstimateReplyToken, stripQuotedReply } = await import(
      "../../src/lib/auth/mail.server"
    );
    const { getSql } = await import("../../src/lib/db");
    const emailId = parsed.data?.email_id;
    const received = emailId ? await fetchReceivedEmail(emailId).catch(() => null) : null;
    const to = [
      ...(received?.to ?? []),
      ...(received?.received_for ?? []),
      ...(parsed.data?.to ?? []),
      ...(parsed.data?.received_for ?? []),
    ];
    const token = parseEstimateReplyToken(to);
    if (!token) return json({ ok: true, ignored: true });
    const text = stripQuotedReply(received?.text || received?.html?.replace(/<[^>]+>/g, " ") || "");
    if (!text) return json({ ok: true, empty: true });
    const sql = await getSql();
    const rows = await sql<Proposal>`select * from proposals where share_token = ${token} limit 1`;
    const proposal = rows[0];
    if (!proposal) return json({ ok: true, missing: true });
    const property = (await sql<Property>`select * from properties where id = ${proposal.property_id}`)[0];
    const name = authorName(received?.from ?? parsed.data?.from) || property?.homeowner_name || "Homeowner";
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
  return json({ received: true });
}

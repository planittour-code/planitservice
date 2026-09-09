import { LEGAL_EMAIL, LEGAL_NAME, LEGAL_SITE } from "@/lib/legal";

function env(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Verified Resend sending domain (subdomain `mail`). */
export const MAIL_DOMAIN = "mail.planitservice.com";
const DEFAULT_FROM = `${LEGAL_NAME} <noreply@${MAIL_DOMAIN}>`;

function fromAddress() {
  return env("EMAIL_FROM") ?? DEFAULT_FROM;
}

function isDeployed() {
  return Boolean(env("DATABASE_URL") || env("NETLIFY"));
}

function resendKey() {
  return env("RESEND_API_KEY");
}

export function estimateReplyTo(token: string) {
  return `estimate+${token}@${MAIL_DOMAIN}`;
}

export function parseEstimateReplyToken(addresses: string[]) {
  for (const raw of addresses) {
    const match = raw.toLowerCase().match(/estimate\+([a-z0-9]+)@/);
    if (match?.[1]) return match[1];
  }
  return null;
}

export async function sendResendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  from?: string;
  attachments?: { filename: string; content: string }[];
}) {
  const key = resendKey();
  if (!key) {
    if (isDeployed()) {
      throw new Error(`We could not send the email. Write ${LEGAL_EMAIL}.`);
    }
    console.info(`[mail] ${input.subject} → ${input.to}\n${input.text}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from ?? fromAddress(),
      to: [input.to],
      reply_to: input.replyTo ?? LEGAL_EMAIL,
      subject: input.subject,
      text: input.text,
      html: input.html,
      ...(input.attachments?.length ? { attachments: input.attachments } : {}),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[mail] Resend rejected send (${res.status}) ${detail}`);
    throw new Error(`We could not send the email. Write ${LEGAL_EMAIL}.`);
  }
}

export async function sendPasswordResetEmail(data: {
  user: { email: string; name?: string | null };
  url: string;
}) {
  const to = data.user.email.trim();
  const name = data.user.name?.trim() || "there";
  const subject = `Reset your ${LEGAL_NAME} password`;
  const text = [
    `Hi ${name},`,
    "",
    `Use this link to choose a new ${LEGAL_NAME} password. It expires in one hour.`,
    "",
    data.url,
    "",
    "If you did not ask for this, ignore the email. Your password stays the same.",
    "",
    LEGAL_NAME,
    LEGAL_SITE,
    LEGAL_EMAIL,
  ].join("\n");
  const html = `<p>Hi ${escapeHtml(name)},</p>
<p>Use this link to choose a new ${escapeHtml(LEGAL_NAME)} password. It expires in one hour.</p>
<p><a href="${escapeHtml(data.url)}">Choose a new password</a></p>
<p>If the button does not work, paste this into your browser:</p>
<p>${escapeHtml(data.url)}</p>
<p>If you did not ask for this, ignore the email. Your password stays the same.</p>
<p>${escapeHtml(LEGAL_NAME)}<br>${escapeHtml(LEGAL_SITE)}<br>${escapeHtml(LEGAL_EMAIL)}</p>`;

  await sendResendEmail({ to, subject, text, html, replyTo: LEGAL_EMAIL });
}

export async function sendEstimateEmail(data: {
  to: string;
  name: string;
  company: string;
  address: string;
  proposalUrl: string;
  inviteUrl: string;
  replyToken: string;
}) {
  const first = data.name.trim().split(/\s+/)[0] || "there";
  const subject = `${data.company} sent an estimate for ${data.address}`;
  const text = [
    `Hi ${first},`,
    "",
    `${data.company} sent an estimate for ${data.address}.`,
    "",
    `Open the estimate: ${data.proposalUrl}`,
    `Property Record: ${data.inviteUrl}`,
    "",
    "Reply to this email with notes or questions. We put the reply on the estimate.",
    "",
    data.company,
  ].join("\n");
  const html = `<p>Hi ${escapeHtml(first)},</p>
<p>${escapeHtml(data.company)} sent an estimate for ${escapeHtml(data.address)}.</p>
<p><a href="${escapeHtml(data.proposalUrl)}">Open the estimate</a></p>
<p>The Property Record for this house: <a href="${escapeHtml(data.inviteUrl)}">${escapeHtml(data.inviteUrl)}</a></p>
<p>Reply to this email with notes or questions. We put the reply on the estimate.</p>
<p>${escapeHtml(data.company)}</p>`;

  await sendResendEmail({
    to: data.to,
    subject,
    text,
    html,
    from: `${data.company} via ${LEGAL_NAME} <noreply@${MAIL_DOMAIN}>`,
    replyTo: estimateReplyTo(data.replyToken),
  });
}

export async function sendManagerInviteEmail(data: {
  to: string;
  name: string;
  office: string;
  address: string;
  inviteUrl: string;
}) {
  const first = data.name.trim().split(/\s+/)[0] || "there";
  const subject = `${data.office} invited you to the Property Record for ${data.address}`;
  const text = [
    `Hi ${first},`,
    "",
    `${data.office} keeps the Property Record for ${data.address}. Photos, jobs, warranties, and issued estimates stay on that file.`,
    "",
    `Sign in to claim your copy: ${data.inviteUrl}`,
    "",
    `${data.office} still manages the house. You get the same record.`,
    "",
    data.office,
  ].join("\n");
  const html = `<p>Hi ${escapeHtml(first)},</p>
<p>${escapeHtml(data.office)} keeps the Property Record for ${escapeHtml(data.address)}. Photos, jobs, warranties, and issued estimates stay on that file.</p>
<p><a href="${escapeHtml(data.inviteUrl)}">Claim your copy</a></p>
<p>${escapeHtml(data.office)} still manages the house. You get the same record.</p>
<p>${escapeHtml(data.office)}</p>`;

  await sendResendEmail({
    to: data.to,
    subject,
    text,
    html,
    from: `${data.office} via ${LEGAL_NAME} <noreply@${MAIL_DOMAIN}>`,
    replyTo: LEGAL_EMAIL,
  });
}

function bytesToBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

export async function sendAcceptedEstimateEmail(data: {
  to: string;
  name: string;
  company: string;
  address: string;
  total: string;
  paymentTerms: string;
  schedule: string[];
  paymentLink: string | null;
  proposalUrl: string;
  pdf: { filename: string; bytes: Uint8Array };
}) {
  const first = data.name.trim().split(/\s+/)[0] || "there";
  const subject = `Accepted estimate from ${data.company} for ${data.address}`;
  const payLines = data.paymentLink
    ? ["", "Pay here:", data.paymentLink]
    : ["", "Ask the shop how they take payment."];
  const text = [
    `Hi ${first},`,
    "",
    `You accepted the estimate from ${data.company} for ${data.address}.`,
    `Total: ${data.total}`,
    "",
    "Payment terms",
    data.paymentTerms,
    ...data.schedule,
    ...payLines,
    "",
    `Open the accepted estimate: ${data.proposalUrl}`,
    "",
    "The signed estimate is attached as a PDF.",
    "",
    data.company,
  ].join("\n");
  const scheduleHtml = data.schedule.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  const payHtml = data.paymentLink
    ? `<p><a href="${escapeHtml(data.paymentLink)}">Pay ${escapeHtml(data.company)}</a></p>
<p>If the button does not work, paste this into your browser:</p>
<p>${escapeHtml(data.paymentLink)}</p>`
    : `<p>Ask ${escapeHtml(data.company)} how they take payment.</p>`;
  const html = `<p>Hi ${escapeHtml(first)},</p>
<p>You accepted the estimate from ${escapeHtml(data.company)} for ${escapeHtml(data.address)}.</p>
<p><strong>Total ${escapeHtml(data.total)}</strong></p>
<p><strong>Payment terms</strong><br>${escapeHtml(data.paymentTerms)}</p>
<ul>${scheduleHtml}</ul>
${payHtml}
<p><a href="${escapeHtml(data.proposalUrl)}">Open the accepted estimate</a></p>
<p>The signed estimate is attached as a PDF.</p>
<p>${escapeHtml(data.company)}</p>`;

  await sendResendEmail({
    to: data.to,
    subject,
    text,
    html,
    from: `${data.company} via ${LEGAL_NAME} <noreply@${MAIL_DOMAIN}>`,
    replyTo: LEGAL_EMAIL,
    attachments: [
      {
        filename: data.pdf.filename,
        content: bytesToBase64(data.pdf.bytes),
      },
    ],
  });
}

export async function fetchReceivedEmail(emailId: string) {
  const key = resendKey();
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Could not load received email (${res.status}) ${detail}`);
  }
  return (await res.json()) as {
    from?: string;
    to?: string[];
    subject?: string;
    text?: string | null;
    html?: string | null;
    received_for?: string[];
  };
}

export function stripQuotedReply(body: string) {
  const cut = body.split(/\n(?:On .+wrote:|-----Original Message-----|>{2,}|\s*From:\s)/i)[0] ?? body;
  return cut.trim();
}

import { LEGAL_EMAIL, LEGAL_NAME, LEGAL_SITE } from "@/lib/legal";
import { estimateEmailCopy, type EstimateEmailLine } from "@/lib/housefile/estimate-email";
import { getResendJson, newIdempotencyKey, postResendEmail } from "@/lib/auth/resend-http";

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
  tags?: { name: string; value: string }[];
  /** One key per send attempt; transient retries reuse it. */
  idempotencyKey?: string;
}): Promise<{ id: string | null }> {
  const key = resendKey();
  if (!key) {
    if (isDeployed()) {
      throw new Error(`We could not send the email. Write ${LEGAL_EMAIL}.`);
    }
    console.info(`[mail] ${input.subject} → ${input.to}\n${input.text}`);
    return { id: null };
  }

  return postResendEmail({
    key,
    idempotencyKey: input.idempotencyKey ?? newIdempotencyKey("mail"),
    payload: {
      from: input.from ?? fromAddress(),
      to: [input.to],
      reply_to: input.replyTo ?? LEGAL_EMAIL,
      subject: input.subject,
      text: input.text,
      html: input.html,
      ...(input.attachments?.length ? { attachments: input.attachments } : {}),
      ...(input.tags?.length ? { tags: input.tags } : {}),
    },
  });
}

export async function sendSalesWelcomeEmail(data: {
  to: string;
  shopName: string;
  loginUrl: string;
}) {
  const shop = data.shopName.trim() || "the shop";
  const first = data.to.split("@")[0] || "there";
  const subject = `Welcome to ${shop} — your sales seat is ready`;
  const text = [
    `Hi ${first},`,
    "",
    `Welcome to ${shop} on ${LEGAL_NAME}. You have a sales seat with your own contractor page.`,
    "",
    "You can create sub-categories, edit line items, send invoices, and add new lines. Those changes stay on your page — they do not change the shop owner's materials.",
    "",
    `Open this link with the email the shop invited: ${data.loginUrl}`,
    "",
    "If you do not have a password yet, create one on that page. If you already have an account, sign in.",
    "",
    shop,
    LEGAL_NAME,
    LEGAL_SITE,
  ].join("\n");
  const html = `<p>Hi ${escapeHtml(first)},</p>
<p>Welcome to ${escapeHtml(shop)} on ${escapeHtml(LEGAL_NAME)}. You have a sales seat with your own contractor page.</p>
<p>You can create sub-categories, edit line items, send invoices, and add new lines. Those changes stay on your page — they do not change the shop owner's materials.</p>
<p><a href="${escapeHtml(data.loginUrl)}">Open your contractor page</a></p>
<p>If you do not have a password yet, create one on that page. If you already have an account, sign in.</p>
<p>${escapeHtml(shop)}<br>${escapeHtml(LEGAL_NAME)}<br>${escapeHtml(LEGAL_SITE)}</p>`;
  await sendResendEmail({ to: data.to, subject, text, html, replyTo: LEGAL_EMAIL });
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
  title?: string;
  coverNote?: string | null;
  terms?: string | null;
  items?: EstimateEmailLine[];
  salesReps?: { name: string; email?: string | null }[];
  tags?: { name: string; value: string }[];
  idempotencyKey?: string;
}): Promise<{ subject: string; text: string; html: string; resendId: string | null }> {
  const { subject, text, html } = estimateEmailCopy({
    name: data.name,
    company: data.company,
    address: data.address,
    title: data.title || "Estimate",
    coverNote: data.coverNote,
    terms: data.terms,
    items: data.items ?? [],
    salesReps: data.salesReps,
    proposalUrl: data.proposalUrl,
    inviteUrl: data.inviteUrl,
  });

  const sent = await sendResendEmail({
    to: data.to,
    subject,
    text,
    html,
    from: `${data.company} via ${LEGAL_NAME} <noreply@${MAIL_DOMAIN}>`,
    replyTo: estimateReplyTo(data.replyToken),
    tags: data.tags,
    idempotencyKey: data.idempotencyKey,
  });
  return { subject, text, html, resendId: sent.id };
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

export async function sendRepeatServiceEmail(data: {
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
  const first = data.name.trim().split(/\s+/)[0] || "there";
  const extras = data.extraWork.filter(Boolean);
  const extraLine = extras.length
    ? `We also offer ${extras.join(", ")} at this address — work this shop quotes.`
    : "";
  const subject = `${data.company}: schedule your next ${data.repeatWork.toLowerCase()} at ${data.address}`;
  const text = [
    `Hi ${first},`,
    "",
    data.lastWork
      ? `${data.company} already completed ${data.lastWork} at ${data.address}.`
      : `${data.company} already worked ${data.address}.`,
    `When you are ready, schedule your next ${data.repeatWork.toLowerCase()} from the Property Record:`,
    "",
    data.fileUrl,
    "",
    extraLine,
    data.projectUrl ? `Start that work with ${data.company}: ${data.projectUrl}` : "",
    extras.length
      ? "Open the File to request that work from us. Request Estimates is for other shops that offer those same categories on your street."
      : "Keep the File so the next visit is not a guess. Request Estimates if you want bids from other shops that offer this work in the area.",
    data.note ? `\n${data.note}\n` : "",
    `Your houses: ${data.homeUrl}`,
    "",
    data.company,
  ]
    .filter((line) => line !== "")
    .join("\n");
  const html = `<p>Hi ${escapeHtml(first)},</p>
<p>${escapeHtml(
    data.lastWork
      ? `${data.company} already completed ${data.lastWork} at ${data.address}.`
      : `${data.company} already worked ${data.address}.`,
  )} When you are ready, schedule your next ${escapeHtml(data.repeatWork.toLowerCase())} from the Property Record.</p>
<p><a href="${escapeHtml(data.fileUrl)}">Open the Property Record</a></p>
${data.projectUrl ? `<p><a href="${escapeHtml(data.projectUrl)}">Start a new project with ${escapeHtml(data.company)}</a></p>` : ""}
${
  extras.length
    ? `<p>We also offer ${escapeHtml(extras.join(", "))} at this address — work this shop quotes. Open the File to request that work from us. Request Estimates is for other shops that offer those same categories on your street.</p>`
    : `<p>Keep the File so the next visit is not a guess. Request Estimates if you want bids from other shops that offer this work in the area.</p>`
}
${data.note ? `<p>${escapeHtml(data.note).replace(/\n/g, "<br>")}</p>` : ""}
<p><a href="${escapeHtml(data.homeUrl)}">Your houses</a></p>
<p>${escapeHtml(data.company)}</p>`;
  await sendResendEmail({
    to: data.to,
    subject,
    text,
    html,
    from: `${data.company} via ${LEGAL_NAME} <noreply@${MAIL_DOMAIN}>`,
    replyTo: LEGAL_EMAIL,
  });
}

export async function sendNamedShopInviteEmail(data: {
  to: string;
  shopName?: string;
  fromName: string;
  address: string;
  title: string;
  body: string;
  quoteUrl: string;
  houseUrl: string;
}) {
  const first = data.shopName?.trim() || "there";
  const subject = `Quote requested for ${data.address}`;
  const text = [
    `Hi ${first},`,
    "",
    `${data.fromName} asked you to quote ${data.title} at ${data.address}.`,
    "",
    data.body,
    "",
    `Open the job and quote from your shop: ${data.quoteUrl}`,
    `Property Record: ${data.houseUrl}`,
    "",
    LEGAL_NAME,
  ].join("\n");
  const html = `<p>Hi ${escapeHtml(first)},</p>
<p>${escapeHtml(data.fromName)} asked you to quote ${escapeHtml(data.title)} at ${escapeHtml(data.address)}.</p>
<p>${escapeHtml(data.body).replace(/\n/g, "<br>")}</p>
<p><a href="${escapeHtml(data.quoteUrl)}">Open the job and quote</a></p>
<p>Property Record: <a href="${escapeHtml(data.houseUrl)}">${escapeHtml(data.houseUrl)}</a></p>
<p>${escapeHtml(LEGAL_NAME)}</p>`;
  await sendResendEmail({
    to: data.to,
    subject,
    text,
    html,
    from: `${data.fromName} via ${LEGAL_NAME} <noreply@${MAIL_DOMAIN}>`,
    replyTo: LEGAL_EMAIL,
  });
}

export async function sendEstimateReviewEmail(data: {
  to: string;
  name: string;
  who: string;
  address: string;
  title: string;
  reason: string;
  proposalUrl: string;
}) {
  const first = data.name.trim().split(/\s+/)[0] || "there";
  const subject = `${data.title} at ${data.address} needs review`;
  const text = [
    `Hi ${first},`,
    "",
    data.reason,
    "",
    `Open the estimate: ${data.proposalUrl}`,
    "",
    data.who,
  ].join("\n");
  const html = `<p>Hi ${escapeHtml(first)},</p>
<p>${escapeHtml(data.reason)}</p>
<p><a href="${escapeHtml(data.proposalUrl)}">Open the estimate</a></p>
<p>${escapeHtml(data.who)}</p>`;
  await sendResendEmail({
    to: data.to,
    subject,
    text,
    html,
    from: `${data.who} via ${LEGAL_NAME} <noreply@${MAIL_DOMAIN}>`,
    replyTo: LEGAL_EMAIL,
    tags: [{ name: "kind", value: "review" }],
  });
}

export async function sendWorkOrderAssignmentEmail(data: {
  to: string;
  shopName: string;
  shopReplyTo: string | null;
  workOrderId: string;
  subject: string;
  text: string;
  html: string;
}) {
  await sendResendEmail({
    to: data.to,
    subject: data.subject,
    text: data.text,
    html: data.html,
    from: `${data.shopName} via ${LEGAL_NAME} <noreply@${MAIL_DOMAIN}>`,
    replyTo: data.shopReplyTo || undefined,
    tags: [
      { name: "kind", value: "work_order_assignment" },
      { name: "work_order_id", value: data.workOrderId },
    ],
  });
}

export async function sendInvoiceEmail(data: {
  to: string;
  shopName: string;
  shopReplyTo: string | null;
  invoiceId: string;
  subject: string;
  text: string;
}) {
  const html = data.text
    .split("\n")
    .map((line) =>
      line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    )
    .join("<br>");
  await sendResendEmail({
    to: data.to,
    subject: data.subject,
    text: data.text,
    html: `<p>${html}</p>`,
    from: `${data.shopName} via ${LEGAL_NAME} <noreply@${MAIL_DOMAIN}>`,
    replyTo: data.shopReplyTo || undefined,
    tags: [
      { name: "kind", value: "invoice" },
      { name: "invoice_id", value: data.invoiceId },
    ],
  });
}

function icsEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function serviceDateIcs(data: {
  uid: string;
  title: string;
  address: string;
  note: string;
  company: string;
  date: string;
  organizer?: string | null;
}) {
  const day = data.date.replace(/-/g, "").slice(0, 8);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const description = `${data.company} is sorry for the change. ${data.note}`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PlanItService//Service Date//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${icsEscape(data.uid)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${day}`,
    `DTEND;VALUE=DATE:${day}`,
    `SUMMARY:${icsEscape(`${data.company}: ${data.title}`)}`,
    `LOCATION:${icsEscape(data.address)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    data.organizer ? `ORGANIZER:mailto:${icsEscape(data.organizer)}` : "",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export async function sendServiceDateEmail(data: {
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
  const first = data.name.trim().split(/\s+/)[0] || "there";
  const subject = `${data.company} is sorry — the service date moved to ${data.serviceDate}`;
  const apology = `We are sorry for the change. ${data.note}`;
  const text = [
    `Hi ${first},`,
    "",
    `${data.company} is sorry to move the service date for ${data.title} at ${data.address}.`,
    `New service date: ${data.serviceDate}`,
    "",
    apology,
    "",
    "A calendar appointment for that day is attached.",
    "",
    data.company,
  ].join("\n");
  const html = `<p>Hi ${escapeHtml(first)},</p>
<p>${escapeHtml(data.company)} is sorry to move the service date for ${escapeHtml(data.title)} at ${escapeHtml(data.address)}.</p>
<p>New service date: <strong>${escapeHtml(data.serviceDate)}</strong></p>
<p>${escapeHtml(apology)}</p>
<p>A calendar appointment for that day is attached.</p>
<p>${escapeHtml(data.company)}</p>`;
  const ics = serviceDateIcs({
    uid: data.eventUid,
    title: data.title,
    address: data.address,
    note: data.note,
    company: data.company,
    date: data.serviceDay,
    organizer: data.replyTo,
  });
  await sendResendEmail({
    to: data.to,
    subject,
    text,
    html,
    from: `${data.company} via ${LEGAL_NAME} <noreply@${MAIL_DOMAIN}>`,
    replyTo: data.replyTo || undefined,
    attachments: [
      {
        filename: "service-date.ics",
        content: Buffer.from(ics, "utf8").toString("base64"),
      },
    ],
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

export async function sendBookingConfirmationEmail(data: {
  to: string;
  name: string;
  whenLabel: string;
  service: string;
  code: string;
  address?: string;
  moved?: boolean;
  shopName: string;
  from: string;
  replyTo: string;
}) {
  const first = data.name.trim().split(/\s+/)[0] || "there";
  const who = data.shopName;
  const subject = data.moved
    ? `Your ${who} visit moved to ${data.whenLabel}`
    : `${who} visit confirmed for ${data.whenLabel}`;
  const line = data.moved
    ? `${who} moved your ${data.service} visit to ${data.whenLabel}.`
    : `You're booked with ${who} for ${data.service} on ${data.whenLabel}.`;
  const text = [
    `Hi ${first},`,
    "",
    line,
    data.address ? `Address: ${data.address}` : "",
    `Confirmation ${data.code}.`,
    "",
    `Reply to this email if you need a different day. It comes straight to ${who}.`,
    "",
    who,
  ]
    .filter((row) => row !== "")
    .join("\n");
  const html = `<p>Hi ${escapeHtml(first)},</p>
<p>${escapeHtml(line)}</p>
${data.address ? `<p>Address: ${escapeHtml(data.address)}</p>` : ""}
<p>Confirmation <strong>${escapeHtml(data.code)}</strong>.</p>
<p>Reply to this email if you need a different day. It comes straight to ${escapeHtml(who)}.</p>
<p>${escapeHtml(who)}</p>`;
  await sendResendEmail({
    to: data.to,
    subject,
    text,
    html,
    from: data.from,
    replyTo: data.replyTo,
  });
}

export async function sendTransferToOwnerEmail(data: {
  to: string;
  from: string;
  replyTo: string;
  shopName: string;
  callerName: string;
  callerPhone: string;
  note: string;
}) {
  const subject = `Call transfer: ${data.callerName || data.shopName + " caller"}`;
  const text = [
    "A caller asked to speak with you.",
    "",
    `Name: ${data.callerName || "not given"}`,
    `Phone: ${data.callerPhone || "not given"}`,
    "",
    data.note || "No note.",
  ].join("\n");
  const html = `<p>A caller asked to speak with you.</p>
<p>Name: ${escapeHtml(data.callerName || "not given")}<br>Phone: ${escapeHtml(data.callerPhone || "not given")}</p>
<p>${escapeHtml(data.note || "No note.")}</p>`;
  await sendResendEmail({
    to: data.to,
    subject,
    text,
    html,
    from: data.from,
    replyTo: data.replyTo,
  });
}

export async function sendProjectOpenedEmail(data: {
  to: string;
  name: string;
  address: string;
  work: string;
  inviteUrl: string;
  shopName: string;
  from: string;
  replyTo: string;
}) {
  const first = data.name.trim().split(/\s+/)[0] || "there";
  const subject = `${data.shopName} has your ${data.work} request`;
  const text = [
    `Hi ${first},`,
    "",
    `We sent your ${data.work} request for ${data.address} to ${data.shopName}. They will follow up with an estimate.`,
    "",
    `View this request: ${data.inviteUrl}`,
    "",
    data.shopName,
  ].join("\n");
  const html = `<p>Hi ${escapeHtml(first)},</p>
<p>We sent your ${escapeHtml(data.work)} request for ${escapeHtml(data.address)} to ${escapeHtml(data.shopName)}. They will follow up with an estimate.</p>
<p><a href="${escapeHtml(data.inviteUrl)}">View this request</a></p>
<p>${escapeHtml(data.shopName)}</p>`;
  await sendResendEmail({
    to: data.to,
    subject,
    text,
    html,
    from: data.from,
    replyTo: data.replyTo,
  });
}

export async function sendTransferConfirmEmail(data: {
  to: string;
  name: string;
  address: string;
  toEmail: string;
  confirmUrl: string;
  code: string;
}) {
  const first = data.name.trim().split(/\s+/)[0] || "there";
  const subject = `Confirm transfer of ${data.address}`;
  const text = [
    `Hi ${first},`,
    "",
    `Someone asked to transfer the Property Record for ${data.address} to ${data.toEmail}.`,
    "",
    "Confirm this transfer with two steps: you are signed in, and you open this email.",
    "",
    `Confirm transfer: ${data.confirmUrl}`,
    `Or enter this code on the Property Record: ${data.code}`,
    "",
    "The code expires in 30 minutes. If you did not ask to transfer this house, ignore this email. The record stays with you.",
    "",
    LEGAL_NAME,
    LEGAL_SITE,
    LEGAL_EMAIL,
  ].join("\n");
  const html = `<p>Hi ${escapeHtml(first)},</p>
<p>Someone asked to transfer the Property Record for ${escapeHtml(data.address)} to ${escapeHtml(data.toEmail)}.</p>
<p>Confirm this transfer with two steps: you are signed in, and you open this email.</p>
<p><a href="${escapeHtml(data.confirmUrl)}">Confirm transfer</a></p>
<p>Or enter this code on the Property Record: <strong>${escapeHtml(data.code)}</strong></p>
<p>The code expires in 30 minutes. If you did not ask to transfer this house, ignore this email. The record stays with you.</p>
<p>${escapeHtml(LEGAL_NAME)}<br>${escapeHtml(LEGAL_SITE)}<br>${escapeHtml(LEGAL_EMAIL)}</p>`;
  await sendResendEmail({ to: data.to, subject, text, html, replyTo: LEGAL_EMAIL });
}

export async function sendTransferClaimEmail(data: {
  to: string;
  address: string;
  fromName: string;
  claimUrl: string;
}) {
  const subject = `Take the Property Record for ${data.address}`;
  const text = [
    `Hi,`,
    "",
    `${data.fromName} confirmed the transfer of the Property Record for ${data.address}.`,
    "",
    `Sign in with this email and accept the record: ${data.claimUrl}`,
    "",
    "Jobs, warranties, and maintenance stay with the address.",
    "",
    LEGAL_NAME,
    LEGAL_SITE,
  ].join("\n");
  const html = `<p>Hi,</p>
<p>${escapeHtml(data.fromName)} confirmed the transfer of the Property Record for ${escapeHtml(data.address)}.</p>
<p><a href="${escapeHtml(data.claimUrl)}">Take this Property Record</a></p>
<p>Sign in with this email. Jobs, warranties, and maintenance stay with the address.</p>
<p>${escapeHtml(LEGAL_NAME)}<br>${escapeHtml(LEGAL_SITE)}</p>`;
  await sendResendEmail({ to: data.to, subject, text, html, replyTo: LEGAL_EMAIL });
}

export type ResendSentEmail = {
  id: string;
  to?: string[];
  from?: string;
  subject?: string;
  html?: string | null;
  text?: string | null;
  created_at?: string;
  last_event?: string | null;
};

function parseResendEmail(raw: unknown): ResendSentEmail | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (!id) return null;
  const to = Array.isArray(row.to)
    ? row.to.filter((item): item is string => typeof item === "string")
    : [];
  return {
    id,
    to,
    from: typeof row.from === "string" ? row.from : undefined,
    subject: typeof row.subject === "string" ? row.subject : undefined,
    html: typeof row.html === "string" ? row.html : null,
    text: typeof row.text === "string" ? row.text : null,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    last_event: typeof row.last_event === "string" ? row.last_event : null,
  };
}

export async function fetchSentEmail(emailId: string): Promise<ResendSentEmail | null> {
  const key = resendKey();
  if (!key) return null;
  const payload = await getResendJson({
    key,
    url: `https://api.resend.com/emails/${encodeURIComponent(emailId)}`,
    label: "retrieve",
  });
  return payload ? parseResendEmail(payload) : null;
}

export async function listSentEmails(limit = 100): Promise<ResendSentEmail[]> {
  const key = resendKey();
  if (!key) return [];
  const payload = (await getResendJson({
    key,
    url: `https://api.resend.com/emails?limit=${Math.min(100, Math.max(1, limit))}`,
    label: "list",
  })) as { data?: unknown[] } | null;
  return (payload?.data ?? []).map(parseResendEmail).filter((row): row is ResendSentEmail => Boolean(row));
}

function sameEmail(left: string | undefined, right: string | undefined) {
  return (left ?? "").trim().toLowerCase() === (right ?? "").trim().toLowerCase();
}

/** Customer estimate letter in Resend — shop review copies use a different subject. */
export async function findCustomerEstimateEmail(input: {
  resendId?: string | null;
  to: string;
  subject: string;
}): Promise<ResendSentEmail | null> {
  if (input.resendId) {
    const stored = await fetchSentEmail(input.resendId);
    if (stored) return stored;
  }
  const listed = await listSentEmails(100);
  const match = listed.find(
    (row) =>
      (row.to ?? []).some((addr) => sameEmail(addr, input.to)) && row.subject === input.subject,
  );
  if (!match) return null;
  return (await fetchSentEmail(match.id)) ?? match;
}

export function deliveryFromLastEvent(lastEvent: string | null | undefined, at: string) {
  const event = (lastEvent ?? "").toLowerCase();
  if (event === "bounced" || event === "failed" || event === "suppressed") {
    return { bouncedAt: at };
  }
  if (event === "opened" || event === "clicked") {
    return { deliveredAt: at, openedAt: at };
  }
  if (event === "delivered" || event === "complained") {
    return { deliveredAt: at };
  }
  return {};
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

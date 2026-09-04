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

function fromAddress() {
  return env("EMAIL_FROM") ?? `${LEGAL_NAME} <noreply@planitservice.com>`;
}

function isDeployed() {
  return Boolean(env("DATABASE_URL") || env("NETLIFY"));
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

  const key = env("RESEND_API_KEY");
  if (!key) {
    if (isDeployed()) {
      throw new Error(`We could not send the reset email. Write ${LEGAL_EMAIL}.`);
    }
    console.info(`[auth] Password reset for ${to}: ${data.url}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [to],
      subject,
      text,
      html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Could not send the reset email (${res.status})${detail ? `: ${detail}` : ""}`);
  }
}

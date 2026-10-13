import { money } from "./format";
import type { ProposalItem } from "./types";

export type EstimateEmailLine = Pick<
  ProposalItem,
  | "name"
  | "description"
  | "qty"
  | "unit"
  | "unit_price"
  | "included"
  | "optional"
  | "manufacturer"
  | "product_name"
  | "sku"
  | "color"
  | "warranty_years"
  | "warranty_terms"
  | "option_id"
>;

export type EstimateEmailInput = {
  name: string;
  company: string;
  address: string;
  title: string;
  coverNote?: string | null;
  terms?: string | null;
  items: EstimateEmailLine[];
  salesReps?: { name: string; email?: string | null }[];
  proposalUrl: string;
  inviteUrl: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nl(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

function showsInstalledProduct(name: string) {
  const n = name.trim().toLowerCase();
  if (!n) return true;
  if (/\bclean(?:ing|er|s)?\b/.test(n)) return false;
  if (/\bdownspouts?\b/.test(n)) return false;
  return true;
}

function showsQuantity(name: string) {
  const n = name.trim().toLowerCase();
  if (!n) return true;
  if (/\bclean(?:ing|er|s)?\b/.test(n) && /\bgutters?\b/.test(n)) return false;
  if (/^gutter cleaning$/.test(n)) return false;
  return true;
}

function lineMeta(item: EstimateEmailLine) {
  const showProduct = showsInstalledProduct(item.name);
  const showQty = showsQuantity(item.name);
  const parts: string[] = [];
  if (showQty && item.qty) parts.push(`${item.qty} ${item.unit}`.trim());
  if (showProduct && item.manufacturer) parts.push(item.manufacturer);
  if (showProduct && item.product_name) parts.push(item.product_name);
  if (showProduct && item.color) parts.push(item.color);
  if (showProduct && item.sku) parts.push(item.sku);
  return parts.join(" · ");
}

function warrantyLine(item: EstimateEmailLine) {
  if (!showsInstalledProduct(item.name) || !item.warranty_terms) return "";
  const years = item.warranty_years ? ` · ${item.warranty_years} yr` : "";
  return `Warranty${years} — ${item.warranty_terms}`;
}

function includedTotal(items: EstimateEmailLine[]) {
  return items.filter((i) => i.included).reduce((sum, i) => sum + i.qty * i.unit_price, 0);
}

export function estimateEmailSubject(company: string, address: string) {
  return `${company} sent an estimate for ${address}`;
}

/** Same letter the customer receives — lines and total, no per-line prices. */
export function estimateEmailCopy(input: EstimateEmailInput) {
  const first = firstName(input.name);
  const subject = estimateEmailSubject(input.company, input.address);
  const included = input.items.filter((item) => item.included && !item.option_id);
  const optionalOpen = input.items.some((item) => item.optional || item.option_id);
  const total = money(includedTotal(input.items));
  const reps = (input.salesReps ?? []).filter((rep) => rep.name.trim());

  const textLines: string[] = [
    `Hi ${first},`,
    "",
    `${input.company} sent an estimate for ${input.address}.`,
    "",
  ];
  if (input.coverNote?.trim()) {
    textLines.push(input.coverNote.trim(), "");
  }
  textLines.push(input.title || "Estimate", "");
  for (const item of included) {
    textLines.push(item.name);
    if (item.description?.trim()) textLines.push(item.description.trim());
    const meta = lineMeta(item);
    if (meta) textLines.push(meta);
    const warranty = warrantyLine(item);
    if (warranty) textLines.push(warranty);
    textLines.push("");
  }
  if (optionalOpen) {
    textLines.push("Open the estimate to review optional work.", "");
  }
  textLines.push(`Total ${total}`, "");
  if (reps.length) {
    textLines.push(reps.length > 1 ? "Salespeople" : "Salesperson");
    for (const rep of reps) {
      textLines.push(rep.email ? `${rep.name} · ${rep.email}` : rep.name);
    }
    textLines.push("");
  }
  if (input.terms?.trim()) {
    textLines.push("Terms", input.terms.trim(), "");
  }
  textLines.push(
    `Open the estimate: ${input.proposalUrl}`,
    `Property Record: ${input.inviteUrl}`,
    "",
    "Reply to this email with notes or questions. We put the reply on the estimate.",
    "",
    input.company,
  );

  const itemRows = included
    .map((item) => {
      const meta = lineMeta(item);
      const warranty = warrantyLine(item);
      return `<tr><td style="padding:10px 0;border-bottom:1px solid #ddd6cc">
<p style="margin:0 0 4px;font-weight:600">${escapeHtml(item.name)}</p>
${item.description?.trim() ? `<p style="margin:0 0 4px;color:#5c574f">${nl(item.description.trim())}</p>` : ""}
${meta ? `<p style="margin:0;color:#5c574f;font-size:13px">${escapeHtml(meta)}</p>` : ""}
${warranty ? `<p style="margin:4px 0 0;color:#2f6b3a;font-size:13px">${escapeHtml(warranty)}</p>` : ""}
</td></tr>`;
    })
    .join("");

  const salesHtml = reps.length
    ? `<p style="margin:16px 0 4px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#5c574f">${
        reps.length > 1 ? "Salespeople" : "Salesperson"
      }</p>${reps
        .map(
          (rep) =>
            `<p style="margin:0 0 4px">${escapeHtml(rep.name)}${
              rep.email ? ` · ${escapeHtml(rep.email)}` : ""
            }</p>`,
        )
        .join("")}`
    : "";

  const html = `<div style="font-family:Georgia,'Times New Roman',serif;color:#2a2723;font-size:16px;line-height:1.5;max-width:640px">
<p style="margin:0 0 12px">Hi ${escapeHtml(first)},</p>
<p style="margin:0 0 16px">${escapeHtml(input.company)} sent an estimate for ${escapeHtml(input.address)}.</p>
${input.coverNote?.trim() ? `<p style="margin:0 0 16px;white-space:pre-wrap">${nl(input.coverNote.trim())}</p>` : ""}
<p style="margin:0 0 12px;font-size:20px">${escapeHtml(input.title || "Estimate")}</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${itemRows}</table>
${optionalOpen ? `<p style="margin:12px 0 0;color:#5c574f">Open the estimate to review optional work.</p>` : ""}
<p style="margin:20px 0 0;font-size:22px">${escapeHtml(total)}</p>
${salesHtml}
${
  input.terms?.trim()
    ? `<p style="margin:20px 0 4px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#5c574f">Terms</p><p style="margin:0 0 16px;color:#5c574f;font-size:14px;white-space:pre-wrap">${nl(input.terms.trim())}</p>`
    : ""
}
<p style="margin:20px 0 8px"><a href="${escapeHtml(input.proposalUrl)}" style="color:#0b3a6a">Open the estimate</a></p>
<p style="margin:0 0 16px">The Property Record for this house: <a href="${escapeHtml(input.inviteUrl)}" style="color:#0b3a6a">${escapeHtml(input.inviteUrl)}</a></p>
<p style="margin:0 0 16px">Reply to this email with notes or questions. We put the reply on the estimate.</p>
<p style="margin:0">${escapeHtml(input.company)}</p>
</div>`;

  return { subject, text: textLines.join("\n"), html };
}

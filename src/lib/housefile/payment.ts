export const PAYMENT_TERMS = [
  "due_completion",
  "split_50",
  "upfront_100",
] as const;

export type PaymentTerms = (typeof PAYMENT_TERMS)[number];

export const PAYMENT_TERM_LABELS: Record<PaymentTerms, string> = {
  due_completion: "Due upon Completion",
  split_50: "50% Upfront / 50% upon Completion",
  upfront_100: "100% Upfront",
};

export function asPaymentTerms(value: string | null | undefined): PaymentTerms {
  return PAYMENT_TERMS.includes(value as PaymentTerms) ? (value as PaymentTerms) : "due_completion";
}

/** Deposit percent due now. Accepts 50, 50/50, or the older preset names. */
export function depositPercent(value: string | null | undefined) {
  const raw = value?.trim() ?? "";
  if (!raw || raw === "due_completion") return 0;
  if (raw === "split_50") return 50;
  if (raw === "upfront_100") return 100;
  const match = raw.match(/\d+(\.\d+)?/);
  const n = match ? Number(match[0]) : 0;
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n * 100) / 100));
}

export function paymentTermLabel(value: string | null | undefined) {
  const raw = value?.trim() ?? "";
  if (PAYMENT_TERMS.includes(raw as PaymentTerms)) return PAYMENT_TERM_LABELS[raw as PaymentTerms];
  const due = depositPercent(raw);
  if (due <= 0) return "Due upon completion";
  if (due >= 100) return "100% due now";
  return `${due}% due now, ${Math.round((100 - due) * 100) / 100}% upon completion`;
}

export function paymentSchedule(total: number, terms: string | null | undefined) {
  const due = depositPercent(terms);
  const now = Math.round(total * due) / 100;
  if (due <= 0) return [{ label: "Due upon completion", amount: total }];
  if (due >= 100) return [{ label: "Due now", amount: total }];
  return [
    { label: `Due now (${due}%)`, amount: now },
    { label: `Due upon completion (${Math.round((100 - due) * 100) / 100}%)`, amount: total - now },
  ];
}

/** Bare host gets https://; anything with a scheme is left as typed. */
function withScheme(raw: string) {
  return /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
}

/**
 * Render-time payment link. http and https both render, byte-identical to what
 * is stored, so links saved before the https rule keep their Pay button
 * (grandfathered, never auto-upgraded). javascript:, data:, mailto: and any
 * other scheme never render. Returns null when nothing usable is stored.
 */
export function normalizePaymentLink(value: string | null | undefined) {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  const href = withScheme(raw);
  try {
    const url = new URL(href);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname) return null;
  } catch {
    return null;
  }
  return href;
}

/** Client and server check for a NEW or edited link (AC 6.3): https only. */
export function isHttpsPaymentLink(value: string | null | undefined) {
  const href = normalizePaymentLink(value);
  if (!href) return false;
  const url = new URL(href);
  return url.protocol === "https:" && url.hostname.includes(".");
}

/**
 * Save-time validation (AC 6.3). Blank clears the link. A value equal to one
 * already stored for this shop/estimate is not an edit, so it is kept exactly
 * as stored even if it is http (no rewrite, no upgrade). Anything newly
 * entered or edited must be https, else this throws before any write.
 */
export function acceptPaymentLink(
  input: string | null | undefined,
  stored: (string | null | undefined)[],
  field = "Payment link",
): string | null {
  const raw = input?.trim() ?? "";
  if (!raw) return null;
  const same = stored.find((v) => v != null && v.trim() === raw);
  if (same != null) return same;
  if (!isHttpsPaymentLink(raw)) throw new Error(`${field} must be a valid https:// link`);
  return withScheme(raw);
}

/** Alphabetic house code from the Property Record invite. MX Merchant invoice numbers stay numeric. */
export function customerCode(token: string | null | undefined) {
  const letters = (token ?? "").replace(/[^a-z]/gi, "").toUpperCase();
  return (letters || "HOUSE").slice(0, 8);
}

/** Numeric invoice for the payment page, paired with the house code in the memo. */
export function paymentInvoiceNumber(proposalId: string) {
  let n = 0;
  for (const ch of proposalId.replace(/-/g, "")) {
    n = (n * 33 + ch.charCodeAt(0)) % 90000000;
  }
  return String(10000000 + n);
}

/** Amount due now, injected on the shop's payment page. No fee is added. */
export function checkoutAmount(total: number, terms: string | null | undefined) {
  const due = paymentSchedule(total, terms)[0]?.amount ?? total;
  return Math.round(due * 100) / 100;
}

/**
 * Prefill an MX Merchant Link2Pay page. Card entry stays on their page.
 * invoiceNumber is numeric. SystemCustomerId and memo carry the house code.
 */
export function mxPaymentUrl(
  base: string | null | undefined,
  input: {
    amount: number;
    invoiceNumber: string;
    customerCode: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    memo?: string | null;
  },
) {
  const href = normalizePaymentLink(base);
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  if (!url.hostname.endsWith("mxmerchant.com")) return href;
  const set = (key: string, value: string | null | undefined) => {
    const next = value?.trim();
    if (next) url.searchParams.set(key, next);
  };
  if (input.amount > 0) url.searchParams.set("amt", input.amount.toFixed(2));
  url.searchParams.set("allowPartial", "0");
  set("invoiceNumber", input.invoiceNumber.replace(/\D/g, "").slice(0, 12));
  set("SystemCustomerId", input.customerCode);
  set("customerName", input.name);
  set("email", input.email);
  set("phone", input.phone);
  set("address", input.address);
  set("city", input.city);
  set("state", input.state?.slice(0, 2).toUpperCase());
  set("zip", input.zip?.replace(/\D/g, "").slice(0, 5));
  set("memo", input.memo ?? `Customer ${input.customerCode} · invoice ${input.invoiceNumber}`);
  url.searchParams.set("showMemo", "0");
  return url.toString();
}

/**
 * Per-shop routing by work type, using only that shop's own fields (AC 6.2/6.8):
 * gutters -> payment_link; paint and everything else -> paint_payment_link ||
 * payment_link. No shop-specific assumptions, no other company's link.
 */
export function shopPaymentLinkForWork(
  workId: string | null | undefined,
  shop: { payment_link?: string | null; paint_payment_link?: string | null },
) {
  if (workId === "gutters") return shop.payment_link ?? null;
  return shop.paint_payment_link || shop.payment_link || null;
}

/**
 * AC 6.2 resolution for an invoice: the proposal's own payment_link (set from
 * the same shop's settings), else the issuing shop's routing for the work type,
 * else none. `shop` must be the invoice's own company row.
 */
export function resolveInvoicePaymentLink(input: {
  proposalPaymentLink: string | null | undefined;
  workId: string | null | undefined;
  shop: { payment_link?: string | null; paint_payment_link?: string | null };
}) {
  return normalizePaymentLink(input.proposalPaymentLink || shopPaymentLinkForWork(input.workId, input.shop));
}

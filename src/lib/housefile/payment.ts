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

/**
 * Normalize a shop-entered payment link (AC 6.3). https only: a bare host gets
 * https://, any other scheme (http:, javascript:, data:, mailto:, ...) is
 * rejected as null. Existing https links come back byte-identical.
 */
export function normalizePaymentLink(value: string | null | undefined) {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  const href = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  if (!/^https:\/\//i.test(href)) return null;
  try {
    const url = new URL(href);
    if (url.protocol !== "https:" || !url.hostname.includes(".")) return null;
  } catch {
    return null;
  }
  return href;
}

export const MAX_PAYMENT_LINKS = 2;
export type ShopPaymentLink = { label: string; url: string };

/**
 * Validate the generic payment links from shop settings. Throws on more than
 * 2, a missing label, or a URL that is not https. Blank rows are dropped.
 */
export function normalizePaymentLinks(input: unknown): ShopPaymentLink[] {
  if (input == null) return [];
  if (!Array.isArray(input)) throw new Error("Payment links must be a list");
  const rows = input
    .map((row) => ({
      label: String((row as { label?: unknown })?.label ?? "").trim(),
      url: String((row as { url?: unknown })?.url ?? "").trim(),
    }))
    .filter((row) => row.label || row.url);
  if (rows.length > MAX_PAYMENT_LINKS) throw new Error(`Up to ${MAX_PAYMENT_LINKS} payment links`);
  return rows.map((row) => {
    if (!row.label) throw new Error("Each payment link needs a label");
    const url = normalizePaymentLink(row.url);
    if (!url) throw new Error(`"${row.label}" needs a valid https:// link`);
    return { label: row.label.slice(0, 40), url };
  });
}

/** Read stored links defensively (never throws; drops anything invalid). */
export function storedPaymentLinks(value: unknown): ShopPaymentLink[] {
  const list = typeof value === "string" ? safeJson(value) : value;
  if (!Array.isArray(list)) return [];
  const out: ShopPaymentLink[] = [];
  for (const row of list) {
    const label = String((row as { label?: unknown })?.label ?? "").trim();
    const url = normalizePaymentLink(String((row as { url?: unknown })?.url ?? ""));
    if (label && url) out.push({ label, url });
    if (out.length === MAX_PAYMENT_LINKS) break;
  }
  return out;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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

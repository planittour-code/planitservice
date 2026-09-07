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

export function paymentTermLabel(value: string | null | undefined) {
  return PAYMENT_TERM_LABELS[asPaymentTerms(value)];
}

export function paymentSchedule(total: number, terms: string | null | undefined) {
  const kind = asPaymentTerms(terms);
  if (kind === "split_50") {
    const half = Math.round(total * 50) / 100;
    return [
      { label: "Due now (50%)", amount: half },
      { label: "Due upon completion (50%)", amount: total - half },
    ];
  }
  if (kind === "upfront_100") {
    return [{ label: "Due now (100%)", amount: total }];
  }
  return [{ label: "Due upon completion", amount: total }];
}

export function normalizePaymentLink(value: string | null | undefined) {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
  return `https://${raw}`;
}

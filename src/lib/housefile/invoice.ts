import { GUTTERS_PLUS_DRAINAGE_KIT } from "./kits";
import { asPaymentTerms, paymentTermLabel } from "./payment";
import type { HouseCompany, InvoiceSalesRep, Property, Proposal, ProposalItem } from "./types";

export type InvoiceView = {
  proposal: Pick<Proposal, "id" | "sent_at" | "accepted_at" | "created_at"> & {
    payment_link?: string | null;
  };
  items: Array<
    Pick<ProposalItem, "id" | "name" | "description" | "qty" | "unit" | "unit_price" | "included" | "option_id">
  >;
  property: Pick<
    Property,
    "homeowner_name" | "homeowner_email" | "homeowner_phone" | "address_line" | "city" | "state" | "zip"
  >;
  company: HouseCompany;
  salesRep: InvoiceSalesRep | null;
  salesReps?: InvoiceSalesRep[];
};

export function invoiceSalesReps(view: Pick<InvoiceView, "salesRep" | "salesReps">): InvoiceSalesRep[] {
  if (view.salesReps?.length) return view.salesReps.slice(0, 2);
  return view.salesRep ? [view.salesRep] : [];
}

export function isDrainageInvoice(title: string | null | undefined) {
  const value = title?.trim() ?? "";
  if (!value) return false;
  if (value.toLowerCase().includes(GUTTERS_PLUS_DRAINAGE_KIT.toLowerCase())) return true;
  return /drainage/i.test(value);
}

export function invoiceNumber(proposal: Pick<Proposal, "id">) {
  if (proposal.id.startsWith("preview")) return "DRAFT";
  return proposal.id.replace(/-/g, "").slice(-5).toUpperCase();
}

export function invoiceDateIso(proposal: Pick<Proposal, "sent_at" | "accepted_at" | "created_at">) {
  return proposal.sent_at || proposal.accepted_at || proposal.created_at;
}

export function invoiceDueLabel(paymentTerms: string | null | undefined) {
  const kind = asPaymentTerms(paymentTerms);
  if (kind === "upfront_100") return "Due on Receipt";
  if (kind === "split_50") return "50% due now";
  return "Due upon Completion";
}

export function invoiceLines(items: InvoiceView["items"]) {
  return items.filter((item) => item.included && !item.option_id);
}

export function invoiceTotal(items: InvoiceView["items"]) {
  return invoiceLines(items).reduce((sum, item) => sum + item.qty * item.unit_price, 0);
}

export function companyPlace(company: Pick<HouseCompany, "street" | "city" | "state" | "zip">) {
  const cityLine = [company.city, company.state].filter(Boolean).join(", ");
  const withZip = [cityLine, company.zip].filter(Boolean).join(" ");
  return [company.street, withZip].filter((line): line is string => Boolean(line));
}

export function companyWebsiteHref(website: string | null | undefined) {
  const raw = website?.trim() ?? "";
  if (!raw) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
  return `https://${raw}`;
}

export function companyWebsiteLabel(website: string | null | undefined) {
  const raw = website?.trim() ?? "";
  if (!raw) return "";
  return raw.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

export function invoicePaymentCopy(input: {
  companyName: string;
  paymentTerms: string | null | undefined;
  invoiceNo: string;
  hasPortal: boolean;
}) {
  const due = invoiceDueLabel(input.paymentTerms);
  const terms = paymentTermLabel(input.paymentTerms);
  const portal = input.hasPortal
    ? "Pay online with the Payment Portal below. Use this invoice number as the purchase order."
    : "Ask the shop how they take payment. Use this invoice number as the purchase order.";
  return [
    `Thank you for your business. Payment is ${due.toLowerCase()} (${terms}).`,
    portal,
    `PO / Invoice # ${input.invoiceNo}.`,
  ].join(" ");
}

export function invoiceThankYou(rep: InvoiceSalesRep | InvoiceSalesRep[] | null) {
  const names = (Array.isArray(rep) ? rep : rep ? [rep] : [])
    .map((row) => row.name.trim())
    .filter(Boolean);
  if (names.length === 1) return `Thank you for your business, ${names[0]}.`;
  if (names.length === 2) return `Thank you for your business, ${names[0]} and ${names[1]}.`;
  return "Thank you for your business.";
}

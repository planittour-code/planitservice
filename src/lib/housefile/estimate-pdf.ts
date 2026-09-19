import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { money, shortDate } from "./format";
import {
  companyPlace,
  companyWebsiteLabel,
  invoiceDateIso,
  invoiceDueLabel,
  invoiceLines,
  invoiceNumber,
  invoicePaymentCopy,
  invoiceThankYou,
  invoiceTotal,
  isDrainageInvoice,
} from "./invoice";
import { paymentSchedule, paymentTermLabel } from "./payment";
import type { Company, InvoiceSalesRep, Property, Proposal, ProposalItem } from "./types";

function includedTotal(items: ProposalItem[]) {
  return items.filter((i) => i.included).reduce((sum, i) => sum + i.qty * i.unit_price, 0);
}

function wrap(text: string, width: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export async function acceptedEstimatePdf(input: {
  company: Pick<
    Company,
    | "name"
    | "email"
    | "phone"
    | "website"
    | "street"
    | "city"
    | "state"
    | "zip"
    | "payment_terms"
    | "payment_link"
    | "terms"
  >;
  property: Property;
  proposal: Proposal;
  items: ProposalItem[];
  salesRep?: InvoiceSalesRep | null;
  salesReps?: InvoiceSalesRep[];
}): Promise<{ filename: string; bytes: Uint8Array }> {
  if (isDrainageInvoice(input.proposal.title)) {
    return invoiceReceiptPdf(input);
  }
  return estimatePdf(input);
}

async function estimatePdf(input: {
  company: Pick<Company, "name" | "email" | "phone" | "payment_terms" | "payment_link" | "terms">;
  property: Property;
  proposal: Proposal;
  items: ProposalItem[];
  salesRep?: InvoiceSalesRep | null;
  salesReps?: InvoiceSalesRep[];
}): Promise<{ filename: string; bytes: Uint8Array }> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [612, 792];
  let page = pdf.addPage(pageSize);
  let y = 748;
  const ink = rgb(0.12, 0.12, 0.12);
  const muted = rgb(0.38, 0.38, 0.38);

  const write = (text: string, opts?: { size?: number; weight?: "bold"; color?: typeof ink; x?: number }) => {
    const size = opts?.size ?? 11;
    const use = opts?.weight === "bold" ? bold : font;
    if (y < 56) {
      page = pdf.addPage(pageSize);
      y = 748;
    }
    page.drawText(text.slice(0, 180), {
      x: opts?.x ?? 48,
      y,
      size,
      font: use,
      color: opts?.color ?? ink,
    });
    y -= size + 6;
  };

  const address = `${input.property.address_line}, ${input.property.city}, ${input.property.state} ${input.property.zip}`;
  const total = includedTotal(input.items);
  const terms = paymentTermLabel(input.company.payment_terms);
  const schedule = paymentSchedule(total, input.company.payment_terms);

  write("Accepted estimate", { size: 18, weight: "bold" });
  write(input.company.name, { size: 13, weight: "bold" });
  if (input.company.phone) write(input.company.phone, { size: 10, color: muted });
  if (input.company.email) write(input.company.email, { size: 10, color: muted });
  y -= 8;
  write(input.proposal.title || "Estimate", { size: 14, weight: "bold" });
  write(address, { size: 11 });
  write(`Prepared for ${input.property.homeowner_name}`, { size: 11, color: muted });
  const reps = input.salesReps?.length ? input.salesReps : input.salesRep ? [input.salesRep] : [];
  for (const rep of reps) {
    write(`${rep.name}${rep.email ? `  ${rep.email}` : ""}`, { size: 10, color: muted });
  }
  y -= 10;

  write("Work", { size: 12, weight: "bold" });
  for (const item of input.items.filter((i) => i.included)) {
    const lineTotal = money(item.qty * item.unit_price);
    write(`${item.name}  ${item.qty} ${item.unit}  ${lineTotal}`, { size: 10 });
    if (item.description) {
      for (const line of wrap(item.description, 90).slice(0, 3)) {
        write(line, { size: 9, color: muted, x: 60 });
      }
    }
  }
  y -= 8;
  write(`Total  ${money(total)}`, { size: 13, weight: "bold" });
  y -= 10;
  write("Payment terms", { size: 12, weight: "bold" });
  write(terms, { size: 11 });
  for (const row of schedule) {
    write(`${row.label}: ${money(row.amount)}`, { size: 10 });
  }
  const payHref = input.proposal.payment_link || input.company.payment_link;
  if (payHref) {
    y -= 4;
    write("Pay", { size: 12, weight: "bold" });
    write(payHref, { size: 10 });
  }
  if (input.company.terms?.trim()) {
    y -= 8;
    write("Terms and conditions", { size: 12, weight: "bold" });
    for (const para of input.company.terms.split(/\n+/)) {
      for (const line of wrap(para, 92)) write(line, { size: 9, color: muted });
    }
  }

  const bytes = await pdf.save();
  return { filename: `estimate-${input.proposal.share_token}.pdf`, bytes };
}

async function invoiceReceiptPdf(input: {
  company: Pick<
    Company,
    | "name"
    | "email"
    | "phone"
    | "website"
    | "street"
    | "city"
    | "state"
    | "zip"
    | "payment_terms"
    | "payment_link"
    | "terms"
  >;
  property: Property;
  proposal: Proposal;
  items: ProposalItem[];
  salesRep?: InvoiceSalesRep | null;
  salesReps?: InvoiceSalesRep[];
}): Promise<{ filename: string; bytes: Uint8Array }> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [612, 792];
  let page = pdf.addPage(pageSize);
  let y = 748;
  const ink = rgb(0.12, 0.12, 0.12);
  const muted = rgb(0.38, 0.38, 0.38);

  const write = (text: string, opts?: { size?: number; weight?: "bold"; color?: typeof ink; x?: number }) => {
    const size = opts?.size ?? 11;
    const use = opts?.weight === "bold" ? bold : font;
    if (y < 56) {
      page = pdf.addPage(pageSize);
      y = 748;
    }
    page.drawText(text.slice(0, 180), {
      x: opts?.x ?? 48,
      y,
      size,
      font: use,
      color: opts?.color ?? ink,
    });
    y -= size + 6;
  };

  const invoiceNo = invoiceNumber(input.proposal);
  const total = invoiceTotal(input.items);
  const place = companyPlace(input.company);
  const website = companyWebsiteLabel(input.company.website);
  const due = invoiceDueLabel(input.company.payment_terms);
  const issued = invoiceDateIso(input.proposal);

  write(input.company.name, { size: 18, weight: "bold" });
  write("Quality and Service", { size: 10, color: muted });
  for (const line of place) write(line, { size: 10, color: muted });
  if (input.company.phone) write(input.company.phone, { size: 10, color: muted });
  if (website) write(website, { size: 10, color: muted });
  write("Licensed and Insured", { size: 9, color: muted });
  y -= 8;
  write("Invoice/Receipt", { size: 16, weight: "bold" });
  write(`Invoice # ${invoiceNo}`, { size: 11 });
  write(`Date ${shortDate(issued)}`, { size: 11 });
  write(`Due ${due}`, { size: 11 });
  y -= 6;
  const reps = input.salesReps?.length ? input.salesReps : input.salesRep ? [input.salesRep] : [];
  if (reps.length) {
    write(reps.length > 1 ? "Sales Representatives" : "Sales Representative", { size: 10, weight: "bold" });
    for (const rep of reps) {
      write(rep.name, { size: 11 });
      if (rep.email) write(rep.email, { size: 10, color: muted });
    }
    y -= 4;
  }
  write("Billing", { size: 10, weight: "bold" });
  write(input.property.homeowner_name, { size: 11 });
  write(
    `${input.property.address_line}, ${input.property.city}, ${input.property.state} ${input.property.zip}`,
    { size: 10, color: muted },
  );
  if (input.property.homeowner_phone) write(input.property.homeowner_phone, { size: 10, color: muted });
  if (input.property.homeowner_email) write(input.property.homeowner_email, { size: 10, color: muted });
  y -= 8;
  write("Product/Service", { size: 12, weight: "bold" });
  for (const item of invoiceLines(input.items)) {
    write(`${item.name}  ${money(item.qty * item.unit_price)}`, { size: 10, weight: "bold" });
    if (item.description) {
      for (const line of wrap(item.description, 90).slice(0, 3)) {
        write(line, { size: 9, color: muted, x: 60 });
      }
    }
    write(`${item.qty} ${item.unit}`, { size: 9, color: muted, x: 60 });
  }
  y -= 8;
  write(`Sub Total  ${money(total)}`, { size: 11 });
  write(`Total  ${money(total)}`, { size: 13, weight: "bold" });
  write(`Amount Paid  ${money(0)}`, { size: 11 });
  write(`Balance Due  ${money(total)}`, { size: 12, weight: "bold" });
  y -= 8;
  for (const line of wrap(
    invoicePaymentCopy({
      companyName: input.company.name,
      paymentTerms: input.company.payment_terms,
      invoiceNo,
      hasPortal: Boolean(input.proposal.payment_link || input.company.payment_link),
    }),
    92,
  )) {
    write(line, { size: 9, color: muted });
  }
  write(invoiceThankYou(input.salesReps?.length ? input.salesReps : input.salesRep ?? null), { size: 10 });
  const pay = input.proposal.payment_link || input.company.payment_link;
  if (pay) {
    y -= 4;
    write("Payment Portal", { size: 11, weight: "bold" });
    write(pay, { size: 10 });
  }
  y -= 8;
  write("Special Instructions", { size: 12, weight: "bold" });
  write("Mail checks to:", { size: 10 });
  write(input.company.name, { size: 10 });
  for (const line of place) write(line, { size: 10, color: muted });
  if (input.company.terms?.trim()) {
    y -= 6;
    for (const para of input.company.terms.split(/\n+/)) {
      for (const line of wrap(para, 92)) write(line, { size: 9, color: muted });
    }
  }

  const bytes = await pdf.save();
  return { filename: `invoice-${invoiceNo}.pdf`, bytes };
}

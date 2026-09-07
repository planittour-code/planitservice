import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { money } from "./format";
import { paymentSchedule, paymentTermLabel } from "./payment";
import type { Company, Property, Proposal, ProposalItem } from "./types";

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
  company: Pick<Company, "name" | "email" | "phone" | "payment_terms" | "payment_link" | "terms">;
  property: Property;
  proposal: Proposal;
  items: ProposalItem[];
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
  if (input.company.payment_link) {
    y -= 4;
    write("Pay", { size: 12, weight: "bold" });
    write(input.company.payment_link, { size: 10 });
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

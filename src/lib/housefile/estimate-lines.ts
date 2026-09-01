import { bookLabel, type PriceBookItem } from "./book";
import { num } from "./format";
import type { QuoteLine } from "./quote";

export const ESTIMATE_KEY = "estimate_lines";

export type EstimateLine = {
  id: string;
  bookId: string;
  item: string;
  description: string;
  qty: string;
  cost: string;
  price: string;
};

export function blankEstimateLine(): EstimateLine {
  return {
    id: crypto.randomUUID(),
    bookId: "",
    item: "",
    description: "",
    qty: "1",
    cost: "",
    price: "",
  };
}

export function parseEstimateLines(raw: string | undefined): EstimateLine[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row) => {
      const r = row as Partial<EstimateLine>;
      return {
        id: String(r.id || crypto.randomUUID()),
        bookId: String(r.bookId ?? ""),
        item: String(r.item ?? ""),
        description: String(r.description ?? ""),
        qty: String(r.qty ?? ""),
        cost: String(r.cost ?? ""),
        price: String(r.price ?? ""),
      };
    });
  } catch {
    return [];
  }
}

export function serializeEstimateLines(lines: EstimateLine[]): string {
  return JSON.stringify(lines);
}

export function lineAmount(line: EstimateLine): number {
  return Math.round(num(line.qty) * num(line.price) * 100) / 100;
}

export function estimateTotal(lines: EstimateLine[]): number {
  return Math.round(lines.reduce((sum, line) => sum + lineAmount(line), 0) * 100) / 100;
}

export function applyBookToLine(line: EstimateLine, item: PriceBookItem | undefined): EstimateLine {
  if (!item) {
    return { ...line, bookId: "", item: line.item };
  }
  const desc = [
    item.color ? `Color: ${item.color}` : "",
    item.sku ? `SKU ${item.sku}` : "",
    item.warranty_years ? `${item.warranty_years}-year warranty` : "",
    item.warranty_terms ?? "",
  ]
    .filter(Boolean)
    .join("\n");
  return {
    ...line,
    bookId: item.id,
    item: bookLabel(item),
    description: line.description.trim() ? line.description : desc,
    cost: item.cost != null ? String(item.cost) : line.cost,
    price: item.sell != null ? String(item.sell) : item.cost != null ? String(item.cost) : line.price,
  };
}

export function estimateLineReady(line: EstimateLine): boolean {
  return Boolean(line.item.trim()) && num(line.qty) > 0 && String(line.price).trim() !== "";
}

export function estimateReady(lines: EstimateLine[]): boolean {
  return lines.some(estimateLineReady);
}

export function toQuoteLines(lines: EstimateLine[], book: PriceBookItem[]): QuoteLine[] {
  return lines.filter(estimateLineReady).map((line) => {
    const item = book.find((b) => b.id === line.bookId);
    const cost = String(line.cost).trim() === "" ? null : num(line.cost);
    return {
      name: line.item.trim(),
      description: line.description.trim(),
      qty: num(line.qty),
      unit: item?.unit || "ea",
      unit_price: num(line.price),
      optional: false,
      included: true,
      category: item?.trade || "quote",
      manufacturer: item?.manufacturer ?? null,
      product_name: item?.product_name ?? line.item.trim(),
      sku: item?.sku ?? null,
      color: item?.color ?? null,
      warranty_years: item?.warranty_years ?? null,
      warranty_terms: item?.warranty_terms ?? null,
      bookId: item?.id,
      unit_cost: cost,
      needsCost: cost == null,
    };
  });
}

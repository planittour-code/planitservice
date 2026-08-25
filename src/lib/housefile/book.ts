import { num } from "./format";
import type { QuoteLine } from "./quote";

export type BookSlotId =
  | "interior_paint"
  | "interior_trim"
  | "exterior_paint"
  | "exterior_trim"
  | "door_paint"
  | "shingle"
  | "window"
  | "gutter"
  | "gutter_guard"
  | "siding"
  | "stain";

export type BookSlot = {
  id: BookSlotId;
  trade: string;
  label: string;
  unit: string;
  mode: "identity" | "replace";
};

export const BOOK_SLOTS: BookSlot[] = [
  { id: "interior_paint", trade: "paint", label: "Interior wall paint", unit: "sf", mode: "identity" },
  { id: "interior_trim", trade: "paint", label: "Interior trim", unit: "room", mode: "identity" },
  { id: "exterior_paint", trade: "paint", label: "Exterior body", unit: "sf", mode: "identity" },
  { id: "exterior_trim", trade: "paint", label: "Exterior trim", unit: "sf", mode: "identity" },
  { id: "door_paint", trade: "paint", label: "Front door", unit: "ea", mode: "identity" },
  { id: "shingle", trade: "roofing", label: "Shingles", unit: "sq", mode: "replace" },
  { id: "window", trade: "windows", label: "Window unit", unit: "ea", mode: "replace" },
  { id: "gutter", trade: "gutters", label: "Gutters", unit: "lf", mode: "replace" },
  { id: "gutter_guard", trade: "gutters", label: "Leaf guards", unit: "lf", mode: "replace" },
  { id: "siding", trade: "siding", label: "Siding", unit: "sf", mode: "replace" },
  { id: "stain", trade: "decks", label: "Deck / porch stain", unit: "sf", mode: "replace" },
];

export const SLOT_BY_ID = Object.fromEntries(BOOK_SLOTS.map((s) => [s.id, s])) as Record<
  BookSlotId,
  BookSlot
>;

export type PriceBookItem = {
  id: string;
  company_id: string;
  trade: string;
  slot: BookSlotId;
  manufacturer: string | null;
  product_name: string;
  sku: string | null;
  color: string | null;
  unit: string;
  cost: number | null;
  sell: number | null;
  warranty_years: number | null;
  warranty_terms: string | null;
  active: boolean;
};

export function slotsForWork(workId: string, inputs: Record<string, string>): BookSlot[] {
  switch (workId) {
    case "paint":
      return inputs.paint_scope === "exterior"
        ? BOOK_SLOTS.filter((s) => ["exterior_paint", "exterior_trim", "door_paint"].includes(s.id))
        : BOOK_SLOTS.filter((s) => ["interior_paint", "interior_trim"].includes(s.id));
    case "roof":
      return BOOK_SLOTS.filter((s) => s.id === "shingle");
    case "windows":
      return BOOK_SLOTS.filter((s) => s.id === "window");
    case "gutters":
      return BOOK_SLOTS.filter((s) => s.id === "gutter" || s.id === "gutter_guard");
    case "siding":
      return BOOK_SLOTS.filter((s) => s.id === "siding");
    case "deck":
    case "porch":
      return BOOK_SLOTS.filter((s) => s.id === "stain");
    default:
      return [];
  }
}

export function pickKey(slot: string) {
  return `book_${slot}`;
}

export function proposedCostKey(itemId: string) {
  return `cost_${itemId}`;
}

export function bookLabel(item: PriceBookItem) {
  const bits = [item.manufacturer, item.product_name, item.color || item.sku].filter(Boolean);
  return bits.join(" · ");
}

export function hydrateBook(row: PriceBookItem): PriceBookItem {
  return {
    ...row,
    cost: row.cost == null ? null : num(row.cost),
    sell: row.sell == null ? null : num(row.sell),
    warranty_years: row.warranty_years == null ? null : num(row.warranty_years),
    active: Boolean(row.active),
    slot: row.slot as BookSlotId,
  };
}

export type PriceIssue = {
  severity: "error" | "warn";
  code: string;
  message: string;
};

const COST_RANGE: Record<BookSlotId, { min: number; max: number; unit: string }> = {
  interior_paint: { min: 0.05, max: 3, unit: "sf" },
  interior_trim: { min: 5, max: 150, unit: "room" },
  exterior_paint: { min: 0.05, max: 3, unit: "sf" },
  exterior_trim: { min: 0.05, max: 3, unit: "sf" },
  door_paint: { min: 5, max: 80, unit: "ea" },
  shingle: { min: 40, max: 350, unit: "sq" },
  window: { min: 80, max: 4000, unit: "ea" },
  gutter: { min: 0.8, max: 25, unit: "lf" },
  gutter_guard: { min: 0.5, max: 30, unit: "lf" },
  siding: { min: 0.8, max: 12, unit: "sf" },
  stain: { min: 0.15, max: 8, unit: "sf" },
};

export function parseMoney(raw: string) {
  if (!raw.trim()) return null;
  const n = Number(raw.replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function priceIssues(item: {
  slot?: string;
  cost: number | null;
  sell: number | null;
}): PriceIssue[] {
  const issues: PriceIssue[] = [];
  const cost = item.cost;
  const sell = item.sell;
  if (cost != null && cost < 0) {
    issues.push({ severity: "error", code: "negative_cost", message: "Cost cannot be negative." });
  }
  if (sell != null && sell < 0) {
    issues.push({ severity: "error", code: "negative_sell", message: "Sell price cannot be negative." });
  }
  if (cost === 0) {
    issues.push({ severity: "error", code: "zero_cost", message: "Cost cannot be zero. Enter what you pay." });
  }
  if (cost == null) {
    issues.push({
      severity: "warn",
      code: "missing_cost",
      message: "No cost. Sales will have to propose one before the quote goes out.",
    });
  }
  if (cost != null && sell != null && sell < cost) {
    issues.push({
      severity: "error",
      code: "sell_below_cost",
      message: "Sell price is below cost.",
    });
  }
  if (cost != null && sell != null && sell > cost * 8) {
    issues.push({
      severity: "warn",
      code: "markup_high",
      message: "Sell is more than 8× cost. Check the unit.",
    });
  }
  const range = item.slot ? COST_RANGE[item.slot as BookSlotId] : undefined;
  if (range && cost != null && cost > 0 && (cost < range.min || cost > range.max)) {
    issues.push({
      severity: "warn",
      code: "cost_range",
      message: `Cost looks off for this product. Typical is ${range.min}–${range.max} per ${range.unit}.`,
    });
  }
  return issues;
}

export function blockingPriceIssues(item: { slot?: string; cost: number | null; sell: number | null }) {
  return priceIssues(item).filter((i) => i.severity === "error");
}

export function assertBookPrices(item: { slot?: string; product_name?: string; cost: number | null; sell: number | null }) {
  const errors = blockingPriceIssues(item);
  if (errors[0]) {
    const who = item.product_name ? `${item.product_name}: ` : "";
    throw new Error(who + errors[0].message);
  }
}

function lineMatchesSlot(line: QuoteLine, slot: BookSlotId) {
  switch (slot) {
    case "interior_paint":
      return line.category === "paint" && /wall/i.test(line.name);
    case "interior_trim":
      return /trim/i.test(line.name) && line.category === "paint";
    case "exterior_paint":
      return line.category === "paint" && /body/i.test(line.name);
    case "exterior_trim":
      return line.category === "paint" && /trim/i.test(line.name);
    case "door_paint":
      return /door/i.test(line.name);
    case "shingle":
      return line.category === "shingle";
    case "window":
      return line.category === "window";
    case "gutter":
      return line.category === "gutter";
    case "gutter_guard":
      return line.category === "guard";
    case "siding":
      return line.category === "siding";
    case "stain":
      return line.category === "stain" || line.category === "floor";
    default:
      return false;
  }
}

export function applyPriceBook(
  lines: QuoteLine[],
  book: PriceBookItem[],
  inputs: Record<string, string>,
): QuoteLine[] {
  const byId = new Map(book.map((b) => [b.id, b]));
  return lines.map((line) => {
    const slot = BOOK_SLOTS.find((s) => lineMatchesSlot(line, s.id));
    if (!slot) return line;
    const pickedId = inputs[pickKey(slot.id)];
    const item = pickedId ? byId.get(pickedId) : undefined;
    if (!item) return { ...line, bookSlot: slot.id };
    const proposedCost = nMaybe(inputs[proposedCostKey(item.id)]);
    const cost = item.cost ?? proposedCost;
    const sell =
      item.sell ??
      (cost != null ? roundMoney(cost * 1.4) : null);
    const next: QuoteLine = {
      ...line,
      bookSlot: slot.id,
      bookId: item.id,
      manufacturer: item.manufacturer,
      product_name: item.product_name,
      sku: item.sku,
      color: item.color ?? line.color,
      warranty_years: item.warranty_years,
      warranty_terms: item.warranty_terms ?? line.warranty_terms,
      unit_cost: cost,
      needsCost: cost == null,
    };
    if (slot.mode === "replace" && sell != null) {
      next.unit_price = sell;
    }
    return next;
  });
}

export function missingCosts(lines: QuoteLine[]) {
  return lines.filter((l) => l.included && l.needsCost);
}

export function linesNeedingBookCost(lines: QuoteLine[], book: PriceBookItem[]) {
  const byId = new Map(book.map((b) => [b.id, b]));
  return lines.filter((l) => {
    if (!l.included || !l.bookId) return false;
    const item = byId.get(l.bookId);
    return Boolean(item && item.cost == null);
  });
}

export function parseBookCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("The file needs a header and at least one row.");
  const header = splitCsv(lines[0]!).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const idx = (name: string) => header.indexOf(name);
  const required = ["trade", "slot", "product_name"];
  for (const key of required) {
    if (idx(key) < 0) throw new Error(`Missing column: ${key}`);
  }
  const rows: Omit<PriceBookItem, "id" | "company_id" | "active">[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsv(line);
    const slot = (cols[idx("slot")] ?? "").trim() as BookSlotId;
    if (!SLOT_BY_ID[slot]) continue;
    const product = (cols[idx("product_name")] ?? "").trim();
    if (!product) continue;
    rows.push({
      trade: (cols[idx("trade")] ?? SLOT_BY_ID[slot].trade).trim() || SLOT_BY_ID[slot].trade,
      slot,
      manufacturer: emptyToNull(cols[idx("manufacturer")]),
      product_name: product,
      sku: emptyToNull(cols[idx("sku")]),
      color: emptyToNull(cols[idx("color")]),
      unit: (cols[idx("unit")] ?? SLOT_BY_ID[slot].unit).trim() || SLOT_BY_ID[slot].unit,
      cost: nMaybe(cols[idx("cost")]),
      sell: nMaybe(cols[idx("sell")]),
      warranty_years: nMaybe(cols[idx("warranty_years")]),
      warranty_terms: emptyToNull(cols[idx("warranty_terms")]),
    });
    const last = rows[rows.length - 1]!;
    assertBookPrices(last);
  }
  if (!rows.length) throw new Error("No usable rows. Check slot names.");
  return rows;
}

export function bookCsvTemplate() {
  return [
    "trade,slot,manufacturer,product_name,sku,color,unit,cost,sell,warranty_years,warranty_terms",
    "roofing,shingle,GAF,Timberline HDZ,Charcoal,Charcoal,sq,112,300,50,50-year limited warranty",
    "windows,window,Andersen,100 Series,,,ea,410,720,20,20-year glass",
    "paint,interior_paint,Sherwin-Williams,Cashmere,SW 7029,Agreeable Gray,sf,0.42,, ,Lifetime washability",
  ].join("\n");
}

function splitCsv(line: string) {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function emptyToNull(v: string | undefined) {
  const s = (v ?? "").trim();
  return s ? s : null;
}

function nMaybe(v: string | undefined) {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(String(v).replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

export const STARTER_BOOK: Omit<PriceBookItem, "id" | "company_id" | "active">[] = [
  { trade: "paint", slot: "interior_paint", manufacturer: "Sherwin-Williams", product_name: "Cashmere", sku: "SW 7029", color: "Agreeable Gray", unit: "sf", cost: 0.42, sell: null, warranty_years: null, warranty_terms: "Lifetime washability of the film when applied per spec." },
  { trade: "paint", slot: "interior_paint", manufacturer: "Sherwin-Williams", product_name: "Cashmere", sku: "SW 7008", color: "Alabaster", unit: "sf", cost: 0.42, sell: null, warranty_years: null, warranty_terms: "Lifetime washability of the film when applied per spec." },
  { trade: "paint", slot: "interior_trim", manufacturer: "Sherwin-Williams", product_name: "Emerald Urethane", sku: null, color: "Extra White, satin", unit: "room", cost: 28, sell: null, warranty_years: 15, warranty_terms: "15-year film warranty." },
  { trade: "paint", slot: "exterior_paint", manufacturer: "Sherwin-Williams", product_name: "Duration Exterior", sku: "SW 7008", color: "Alabaster", unit: "sf", cost: 0.38, sell: null, warranty_years: 15, warranty_terms: "15-year film warranty." },
  { trade: "paint", slot: "exterior_trim", manufacturer: "Sherwin-Williams", product_name: "Duration Exterior", sku: null, color: "Extra White", unit: "sf", cost: 0.38, sell: null, warranty_years: 15, warranty_terms: "15-year film warranty." },
  { trade: "paint", slot: "door_paint", manufacturer: "Sherwin-Williams", product_name: "Emerald Urethane", sku: "SW 2801", color: "Rookwood Red", unit: "ea", cost: 22, sell: null, warranty_years: 15, warranty_terms: "15-year film warranty." },
  { trade: "roofing", slot: "shingle", manufacturer: "GAF", product_name: "Timberline HDZ", sku: "Charcoal", color: "Charcoal", unit: "sq", cost: 112, sell: 300, warranty_years: 50, warranty_terms: "50-year limited warranty. Golden Pledge available." },
  { trade: "windows", slot: "window", manufacturer: "Andersen", product_name: "100 Series", sku: null, color: null, unit: "ea", cost: 410, sell: 720, warranty_years: 20, warranty_terms: "20-year glass. 10-year hardware when registered." },
  { trade: "windows", slot: "window", manufacturer: "Marvin", product_name: "Essential", sku: null, color: null, unit: "ea", cost: null, sell: null, warranty_years: 20, warranty_terms: "20-year glass. 10-year hardware when registered." },
  { trade: "gutters", slot: "gutter", manufacturer: "LeafFilter", product_name: "6-inch aluminum", sku: null, color: "White", unit: "lf", cost: 4.2, sell: 12, warranty_years: 25, warranty_terms: "25-year finish warranty." },
  { trade: "gutters", slot: "gutter_guard", manufacturer: "LeafFilter", product_name: "Micromesh", sku: null, color: null, unit: "lf", cost: 7.5, sell: 18, warranty_years: null, warranty_terms: "Limited lifetime clog-free warranty." },
  { trade: "siding", slot: "siding", manufacturer: "James Hardie", product_name: "HardiePlank", sku: null, color: "Arctic White", unit: "sf", cost: 3.4, sell: 9.4, warranty_years: 30, warranty_terms: "30-year substrate. Color Plus 15-year finish." },
  { trade: "decks", slot: "stain", manufacturer: "Ready Seal", product_name: "Ready Seal", sku: "Dark Walnut", color: "Dark Walnut", unit: "sf", cost: 0.85, sell: 3.4, warranty_years: 3, warranty_terms: "3-year maintenance coat recommended." },
];

type CatalogRow = Omit<PriceBookItem, "id" | "company_id" | "active">;

export const HOME_DEPOT_BOOK: CatalogRow[] = [
  { trade: "paint", slot: "interior_paint", manufacturer: "BEHR", product_name: "Marquee Interior", sku: "PPU18-06", color: "Swiss Coffee", unit: "sf", cost: 0.38, sell: null, warranty_years: null, warranty_terms: "Limited lifetime film warranty on the label." },
  { trade: "paint", slot: "interior_trim", manufacturer: "BEHR", product_name: "Alkyd Enamel", sku: null, color: "Ultra Pure White, satin", unit: "room", cost: 24, sell: null, warranty_years: 15, warranty_terms: "15-year film warranty." },
  { trade: "paint", slot: "exterior_paint", manufacturer: "BEHR", product_name: "Marquee Exterior", sku: "N/A", color: "Swiss Coffee", unit: "sf", cost: 0.36, sell: null, warranty_years: 15, warranty_terms: "Limited lifetime exterior film warranty." },
  { trade: "paint", slot: "exterior_trim", manufacturer: "BEHR", product_name: "Marquee Exterior", sku: null, color: "Ultra Pure White", unit: "sf", cost: 0.36, sell: null, warranty_years: 15, warranty_terms: "Limited lifetime exterior film warranty." },
  { trade: "paint", slot: "door_paint", manufacturer: "BEHR", product_name: "Alkyd Enamel", sku: null, color: "Crimson Red", unit: "ea", cost: 18, sell: null, warranty_years: 15, warranty_terms: "15-year film warranty." },
  { trade: "roofing", slot: "shingle", manufacturer: "GAF", product_name: "Timberline HDZ", sku: "Charcoal", color: "Charcoal", unit: "sq", cost: 108, sell: 295, warranty_years: 50, warranty_terms: "50-year limited warranty. Golden Pledge available." },
  { trade: "windows", slot: "window", manufacturer: "Andersen", product_name: "100 Series", sku: null, color: "White", unit: "ea", cost: 398, sell: 710, warranty_years: 20, warranty_terms: "20-year glass. 10-year hardware when registered." },
  { trade: "gutters", slot: "gutter", manufacturer: "Amerimax", product_name: "5-inch K-style", sku: null, color: "White", unit: "lf", cost: 3.4, sell: 11, warranty_years: 20, warranty_terms: "20-year finish warranty." },
  { trade: "gutters", slot: "gutter_guard", manufacturer: "GutterStuff", product_name: "Foam insert", sku: null, color: null, unit: "lf", cost: 2.1, sell: 8, warranty_years: 10, warranty_terms: "10-year clog-free claim on the insert." },
  { trade: "siding", slot: "siding", manufacturer: "James Hardie", product_name: "HardiePlank", sku: null, color: "Arctic White", unit: "sf", cost: 3.4, sell: 9.4, warranty_years: 30, warranty_terms: "30-year substrate. Color Plus 15-year finish." },
  { trade: "decks", slot: "stain", manufacturer: "Olympic", product_name: "Maximum Stain + Sealant", sku: "Dark Walnut", color: "Dark Walnut", unit: "sf", cost: 0.72, sell: 3.1, warranty_years: 4, warranty_terms: "4-year coating warranty on the can." },
];

export const LOWES_BOOK: CatalogRow[] = [
  { trade: "paint", slot: "interior_paint", manufacturer: "Valspar", product_name: "Reserve Interior", sku: null, color: "Cotton White", unit: "sf", cost: 0.4, sell: null, warranty_years: null, warranty_terms: "Lifetime film warranty on the label." },
  { trade: "paint", slot: "interior_trim", manufacturer: "Valspar", product_name: "Reserve Enamel", sku: null, color: "Ultra White, satin", unit: "room", cost: 26, sell: null, warranty_years: 15, warranty_terms: "15-year film warranty." },
  { trade: "paint", slot: "exterior_paint", manufacturer: "Valspar", product_name: "Reserve Exterior", sku: null, color: "Cotton White", unit: "sf", cost: 0.37, sell: null, warranty_years: 15, warranty_terms: "Limited lifetime exterior film warranty." },
  { trade: "paint", slot: "exterior_trim", manufacturer: "Valspar", product_name: "Reserve Exterior", sku: null, color: "Ultra White", unit: "sf", cost: 0.37, sell: null, warranty_years: 15, warranty_terms: "Limited lifetime exterior film warranty." },
  { trade: "paint", slot: "door_paint", manufacturer: "Valspar", product_name: "Reserve Enamel", sku: null, color: "Barn Red", unit: "ea", cost: 19, sell: null, warranty_years: 15, warranty_terms: "15-year film warranty." },
  { trade: "roofing", slot: "shingle", manufacturer: "Owens Corning", product_name: "Duration", sku: "Estate Gray", color: "Estate Gray", unit: "sq", cost: 118, sell: 310, warranty_years: 50, warranty_terms: "Limited lifetime. Platinum Protection available." },
  { trade: "windows", slot: "window", manufacturer: "Pella", product_name: "250 Series", sku: null, color: "White", unit: "ea", cost: 385, sell: 690, warranty_years: 20, warranty_terms: "20-year glass. 10-year hardware when registered." },
  { trade: "gutters", slot: "gutter", manufacturer: "Amerimax", product_name: "6-inch K-style", sku: null, color: "White", unit: "lf", cost: 3.8, sell: 12, warranty_years: 20, warranty_terms: "20-year finish warranty." },
  { trade: "gutters", slot: "gutter_guard", manufacturer: "LeafFilter", product_name: "Micromesh", sku: null, color: null, unit: "lf", cost: 7.5, sell: 18, warranty_years: null, warranty_terms: "Limited lifetime clog-free warranty." },
  { trade: "siding", slot: "siding", manufacturer: "LP", product_name: "SmartSide", sku: null, color: "Cedar", unit: "sf", cost: 2.9, sell: 8.2, warranty_years: 50, warranty_terms: "50-year substrate warranty." },
  { trade: "decks", slot: "stain", manufacturer: "Olympic", product_name: "Rescue It!", sku: "Chocolate", color: "Chocolate", unit: "sf", cost: 0.9, sell: 3.5, warranty_years: 3, warranty_terms: "3-year coating warranty on the can." },
];

export function catalogFor(source: "homedepot" | "lowes" | "starter") {
  if (source === "homedepot") return HOME_DEPOT_BOOK;
  if (source === "lowes") return LOWES_BOOK;
  return STARTER_BOOK;
}

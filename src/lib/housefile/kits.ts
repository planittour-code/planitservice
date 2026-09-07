import type { BookSlotId } from "./book";
import { SLOT_BY_ID } from "./book";
import { customWorkId, WORK_BY_ID, WORK_TYPES } from "./quote";

export type WorkKitItem = {
  id: string;
  kit_id: string;
  sort_order: number;
  name: string;
  description: string | null;
  qty: string | null;
  unit: string;
  slot: string | null;
};

export type WorkKit = {
  id: string;
  company_id: string;
  work_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  items: WorkKitItem[];
};

type SeedLine = {
  name: string;
  description: string;
  qty?: string;
  unit?: string;
  slot?: BookSlotId;
};

function gutterNew(size: "5-Inch" | "6-Inch"): SeedLine[] {
  const run = size === "5-Inch" ? "5-inch" : "6-inch";
  return [
    {
      name: `Hang ${run} K-style gutters`,
      description: `Seamless ${run} aluminum on the eaves.`,
      unit: "lf",
      slot: "gutter",
    },
    { name: "Downspouts and elbows", description: "Leaders to grade.", unit: "ea" },
    { name: "Hidden hangers", description: "Hangers on the new run.", unit: "lf" },
    { name: "End caps, outlets, and miters", description: "Fits and corners.", unit: "ls", qty: "1" },
    { name: "Seal joints and splash blocks", description: "Close the run and splash at grade.", unit: "ls", qty: "1" },
  ];
}

function gutterReplace(size: "5-Inch" | "6-Inch"): SeedLine[] {
  return [
    { name: "Remove existing gutters and hangers", description: "Pull the old run.", unit: "lf" },
    { name: "Haul-off and protect the beds", description: "Debris and site protection.", unit: "ls", qty: "1" },
    ...gutterNew(size),
  ];
}

export const GUTTER_KIT_SEED: { name: string; lines: SeedLine[] }[] = [
  { name: "5-Inch New Install", lines: gutterNew("5-Inch") },
  { name: "5-Inch Replacement", lines: gutterReplace("5-Inch") },
  { name: "6-Inch New Install", lines: gutterNew("6-Inch") },
  { name: "6-Inch Replacement", lines: gutterReplace("6-Inch") },
];

const WORK_ALIASES: Record<string, string> = {
  gutter: "gutters",
  roofing: "roof",
  window: "windows",
  painting: "paint",
  decks: "deck",
  porches: "porch",
};

export function workIdFromLabel(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  const aliased = WORK_ALIASES[value.toLowerCase()] ?? value;
  if (WORK_BY_ID[aliased]) return aliased;
  const byName = WORK_TYPES.find((w) => w.name.toLowerCase() === aliased.toLowerCase());
  if (byName) return byName.id;
  if (value.startsWith("custom:")) return value;
  return customWorkId(value);
}

export function workLabel(workId: string) {
  return WORK_BY_ID[workId]?.name ?? (workId.replace(/^custom:/, "") || workId);
}

export type CatalogCsvProduct = {
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
};

export type CatalogCsvKitLine = {
  work_id: string;
  sub_category: string;
  name: string;
  description: string;
  qty: string;
  unit: string;
  slot: string | null;
};

export type CatalogCsv = {
  products: CatalogCsvProduct[];
  kitLines: CatalogCsvKitLine[];
};

export function catalogHeaderFromCsv(text: string) {
  const line =
    text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .find((l) => l.trim()) ?? "";
  return splitCsv(line).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
}

export function isCatalogCsvHeader(header: string[]) {
  return header.includes("sub_category") || header.includes("work_category") || header.includes("line_item");
}

export function parseCatalogCsv(text: string): CatalogCsv {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("The file needs a header and at least one row.");
  const header = splitCsv(lines[0]!).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const idx = (name: string) => header.indexOf(name);
  const col = (cols: string[], name: string, alt?: string) => {
    const i = idx(name) >= 0 ? idx(name) : alt ? idx(alt) : -1;
    return i >= 0 ? (cols[i] ?? "").trim() : "";
  };

  const products: CatalogCsvProduct[] = [];
  const kitLines: CatalogCsvKitLine[] = [];

  for (const line of lines.slice(1)) {
    const cols = splitCsv(line);
    const workRaw = col(cols, "work_category", "work_id") || col(cols, "trade");
    const sub = col(cols, "sub_category");
    const item = col(cols, "item", "line_item");
    const productName = col(cols, "product_name");
    const slotRaw = col(cols, "slot");
    const slot = SLOT_BY_ID[slotRaw as BookSlotId] ? (slotRaw as BookSlotId) : null;

    if (sub && item) {
      kitLines.push({
        work_id: workIdFromLabel(workRaw || "gutters"),
        sub_category: sub,
        name: item,
        description: col(cols, "description"),
        qty: col(cols, "qty"),
        unit: col(cols, "unit") || "ls",
        slot,
      });
    }

    if (productName && slot) {
      products.push({
        trade: workRaw || SLOT_BY_ID[slot].trade,
        slot,
        manufacturer: emptyToNull(col(cols, "manufacturer")),
        product_name: productName,
        sku: emptyToNull(col(cols, "sku")),
        color: emptyToNull(col(cols, "color")),
        unit: col(cols, "unit") || SLOT_BY_ID[slot].unit,
        cost: nMaybe(col(cols, "cost")),
        sell: nMaybe(col(cols, "sell")),
        warranty_years: nMaybe(col(cols, "warranty_years")),
        warranty_terms: emptyToNull(col(cols, "warranty_terms")),
      });
    }
  }

  if (!products.length && !kitLines.length) {
    throw new Error("No usable rows. Need sub_category + item for kits, or slot + product_name for materials.");
  }
  return { products, kitLines };
}

export function shopCsvTemplate() {
  return [
    "work_category,sub_category,item,description,qty,unit,slot,manufacturer,product_name,sku,color,cost,sell,warranty_years,warranty_terms",
    "gutters,5-Inch New Install,Hang 5-inch K-style gutters,Seamless aluminum on the eaves,,lf,gutter,LeafFilter,5-inch aluminum,,White,3.8,11,25,25-year finish",
    "gutters,5-Inch New Install,Downspouts and elbows,Leaders to grade,,ea,,,,,,,,",
    "gutters,5-Inch New Install,Hidden hangers,Hangers on the new run,,lf,,,,,,,,",
    "gutters,5-Inch New Install,End caps outlets and miters,Fits and corners,1,ls,,,,,,,,",
    "gutters,5-Inch New Install,Seal joints and splash blocks,Close the run,1,ls,,,,,,,,",
    "gutters,5-Inch Replacement,Remove existing gutters and hangers,Pull the old run,,lf,,,,,,,,",
    "gutters,5-Inch Replacement,Haul-off and protect the beds,Debris and site protection,1,ls,,,,,,,,",
    "gutters,5-Inch Replacement,Hang 5-inch K-style gutters,Seamless aluminum on the eaves,,lf,gutter,,,,,,,",
    "gutters,5-Inch Replacement,Downspouts and elbows,Leaders to grade,,ea,,,,,,,,",
    "gutters,5-Inch Replacement,Hidden hangers,Hangers on the new run,,lf,,,,,,,,",
    "gutters,5-Inch Replacement,End caps outlets and miters,Fits and corners,1,ls,,,,,,,,",
    "gutters,5-Inch Replacement,Seal joints and splash blocks,Close the run,1,ls,,,,,,,,",
    "gutters,6-Inch New Install,Hang 6-inch K-style gutters,Seamless aluminum on the eaves,,lf,gutter,LeafFilter,6-inch aluminum,,White,4.2,12,25,25-year finish",
    "gutters,6-Inch New Install,Downspouts and elbows,Leaders to grade,,ea,,,,,,,,",
    "gutters,6-Inch New Install,Hidden hangers,Hangers on the new run,,lf,,,,,,,,",
    "gutters,6-Inch New Install,End caps outlets and miters,Fits and corners,1,ls,,,,,,,,",
    "gutters,6-Inch New Install,Seal joints and splash blocks,Close the run,1,ls,,,,,,,,",
    "gutters,6-Inch Replacement,Remove existing gutters and hangers,Pull the old run,,lf,,,,,,,,",
    "gutters,6-Inch Replacement,Haul-off and protect the beds,Debris and site protection,1,ls,,,,,,,,",
    "gutters,6-Inch Replacement,Hang 6-inch K-style gutters,Seamless aluminum on the eaves,,lf,gutter,,,,,,,",
    "gutters,6-Inch Replacement,Downspouts and elbows,Leaders to grade,,ea,,,,,,,,",
    "gutters,6-Inch Replacement,Hidden hangers,Hangers on the new run,,lf,,,,,,,,",
    "gutters,6-Inch Replacement,End caps outlets and miters,Fits and corners,1,ls,,,,,,,,",
    "gutters,6-Inch Replacement,Seal joints and splash blocks,Close the run,1,ls,,,,,,,,",
  ].join("\n");
}

export function kitsToCsv(kits: WorkKit[]) {
  const header =
    "work_category,sub_category,item,description,qty,unit,slot,manufacturer,product_name,sku,color,cost,sell,warranty_years,warranty_terms";
  const rows = kits.flatMap((kit) =>
    kit.items.map((item) =>
      [
        csvCell(workLabel(kit.work_id)),
        csvCell(kit.name),
        csvCell(item.name),
        csvCell(item.description ?? ""),
        csvCell(item.qty ?? ""),
        csvCell(item.unit),
        csvCell(item.slot ?? ""),
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ].join(","),
    ),
  );
  return [header, ...rows].join("\n");
}

function csvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
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

function emptyToNull(v: string) {
  return v.trim() ? v.trim() : null;
}

function nMaybe(v: string) {
  if (!v.trim()) return null;
  const n = Number(v.replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

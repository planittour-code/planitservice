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
  photos: string[];
};

export function parseKitPhotos(raw: unknown): string[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      return [];
    }
  }
  return list
    .filter((p): p is string => typeof p === "string" && p.startsWith("data:image/"))
    .slice(0, 8);
}

export function kitPhotosPayload(photos?: string[]) {
  const clean = parseKitPhotos(photos);
  return clean.length ? JSON.stringify(clean) : null;
}

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

export type KitSeed = { name: string; lines: SeedLine[] };

const ls = (name: string, description: string): SeedLine => ({
  name,
  description,
  unit: "ls",
  qty: "1",
});

export const GUTTER_KIT_SEED: KitSeed[] = [
  { name: "5-Inch New Install", lines: gutterNew("5-Inch") },
  { name: "5-Inch Replacement", lines: gutterReplace("5-Inch") },
  { name: "6-Inch New Install", lines: gutterNew("6-Inch") },
  { name: "6-Inch Replacement", lines: gutterReplace("6-Inch") },
];

const PAINT_KIT_SEED: KitSeed[] = [
  {
    name: "Interior walls and trim",
    lines: [
      ls("Protect floors and furniture", "Cover, mask, and move what has to move."),
      { name: "Prime as needed", description: "Spot prime repairs and bare stock.", unit: "sf" },
      { name: "Paint walls", description: "Body color in the rooms.", unit: "sf", slot: "interior_paint" },
      { name: "Paint trim and doors", description: "Casing, base, and doors.", unit: "room", slot: "interior_trim" },
      ls("Cleanup", "Pull paper and leave the rooms ready."),
    ],
  },
  {
    name: "Interior cabinets",
    lines: [
      ls("Remove doors and hardware", "Label and store for rehang."),
      ls("Prime cabinets", "Doors and frames."),
      ls("Paint doors and frames", "Enamel on the kitchen or bath boxes."),
      ls("Rehang and hardware", "Doors, pulls, and catches."),
    ],
  },
  {
    name: "Exterior body and trim",
    lines: [
      { name: "Wash and scrape", description: "Prep the elevations.", unit: "sf" },
      { name: "Paint body", description: "Siding and field.", unit: "sf", slot: "exterior_paint" },
      { name: "Paint trim", description: "Fascia, soffit, and casing.", unit: "sf", slot: "exterior_trim" },
      ls("Cleanup", "Site and beds."),
    ],
  },
  {
    name: "Front door",
    lines: [
      ls("Prep the door", "Sand, fill, and mask the opening."),
      { name: "Enamel the door", description: "One opening, both faces as quoted.", unit: "ea", qty: "1", slot: "door_paint" },
    ],
  },
];

const reroofLines: SeedLine[] = [
  { name: "Install shingles", description: "Field, hips, and ridges.", unit: "sq", slot: "shingle" },
  ls("Drip edge and flashing", "Eaves, walls, and penetrations."),
  ls("Vents and pipe boots", "Intake, exhaust, and boots."),
  ls("Cleanup", "Magnets and haul-off of scraps."),
];

const ROOF_KIT_SEED: KitSeed[] = [
  {
    name: "Tear-off and reroof",
    lines: [
      { name: "Tear off one layer", description: "Shingles and felt to the deck.", unit: "sq" },
      ls("Haul-off", "Debris from one layer."),
      ...reroofLines,
    ],
  },
  {
    name: "Two-layer tear-off",
    lines: [
      { name: "Tear off two layers", description: "Second layer is slower.", unit: "sq" },
      ls("Extra haul-off", "Two layers of debris."),
      ...reroofLines,
    ],
  },
  {
    name: "New construction",
    lines: reroofLines,
  },
  {
    name: "Leak repair",
    lines: [
      ls("Isolate the leak", "Find the path, not just the stain."),
      ls("Repair the roof", "Shingles, flashing, or boot as needed."),
      ls("Seal and test", "Close the repair and water-test if we can."),
    ],
  },
];

function windowLines(kind: "replace" | "new"): SeedLine[] {
  const start: SeedLine[] =
    kind === "replace"
      ? [{ name: "Remove existing units", description: "Pull sash, frame, and old flashing.", unit: "ea" }]
      : [];
  return [
    ...start,
    { name: "Set new windows", description: "Plumb, shim, and fasten.", unit: "ea", slot: "window" },
    { name: "Insulate and flash", description: "Foam, tape, and pan at each opening.", unit: "ea" },
    { name: "Interior casing", description: "Casing and stool at each unit.", unit: "ea" },
    { name: "Screens", description: "Full screens on each unit.", unit: "ea" },
    ls("Haul-off", "Old units and debris."),
  ];
}

const WINDOW_KIT_SEED: KitSeed[] = [
  { name: "Full-house replacement", lines: windowLines("replace") },
  { name: "Partial replacement", lines: windowLines("replace") },
  { name: "New construction openings", lines: windowLines("new") },
];

const SIDING_KIT_SEED: KitSeed[] = [
  {
    name: "Full elevation replacement",
    lines: [
      { name: "Tear off existing siding", description: "Cladding off the elevations in this quote.", unit: "sf" },
      { name: "Housewrap", description: "Wrap and tape at openings.", unit: "sf" },
      { name: "Hang new siding", description: "The product that stays with the house.", unit: "sf", slot: "siding" },
      ls("Trim and corners", "Outside corners, windows, and doors."),
      ls("Cleanup", "Haul-off and site."),
    ],
  },
  {
    name: "Partial / repair",
    lines: [
      ls("Isolate failed siding", "Cut back to sound stock."),
      { name: "Replace failed siding", description: "Blend into the elevation.", unit: "sf", slot: "siding" },
      ls("Trim and seal", "Joints, corners, and openings."),
    ],
  },
  {
    name: "New construction",
    lines: [
      { name: "Housewrap", description: "Wrap and tape at openings.", unit: "sf" },
      { name: "Hang new siding", description: "The product that stays with the house.", unit: "sf", slot: "siding" },
      ls("Trim and corners", "Outside corners, windows, and doors."),
      ls("Cleanup", "Site."),
    ],
  },
];

const DECK_KIT_SEED: KitSeed[] = [
  {
    name: "New deck",
    lines: [
      ls("Frame the deck", "Posts, beams, and joists."),
      { name: "Decking", description: "Walking surface.", unit: "sf" },
      ls("Rail", "Pickets, cap, and posts."),
      { name: "Stain", description: "The coat that stays with the house.", unit: "sf", slot: "stain" },
    ],
  },
  {
    name: "Redeck",
    lines: [
      { name: "Pull existing boards", description: "Keep the frame if it is sound.", unit: "sf" },
      { name: "New decking", description: "Walking surface.", unit: "sf" },
      { name: "Stain", description: "The coat that stays with the house.", unit: "sf", slot: "stain" },
    ],
  },
  {
    name: "Stain and repair",
    lines: [
      { name: "Replace failed boards", description: "Swap what will not take stain.", unit: "ea" },
      { name: "Clean the deck", description: "Wash and dull the old coat.", unit: "sf" },
      { name: "Stain", description: "The coat that stays with the house.", unit: "sf", slot: "stain" },
    ],
  },
];

const PORCH_KIT_SEED: KitSeed[] = [
  {
    name: "Open porch",
    lines: [
      { name: "Porch floor", description: "Boards or overlay on this porch.", unit: "sf" },
      ls("Rail", "Pickets, cap, and posts."),
      { name: "Stain the floor", description: "The coat on the walking surface.", unit: "sf", slot: "stain" },
    ],
  },
  {
    name: "Covered porch",
    lines: [
      { name: "Porch floor", description: "Boards or overlay on this porch.", unit: "sf" },
      ls("Ceiling", "Beadboard or the existing ceiling."),
      ls("Rail", "Pickets, cap, and posts."),
      { name: "Stain or paint", description: "Floor, ceiling, and rail as quoted.", unit: "sf", slot: "stain" },
    ],
  },
  {
    name: "Screened porch",
    lines: [
      { name: "Porch floor", description: "Boards or overlay on this porch.", unit: "sf" },
      ls("Screen panels", "Walls of this porch."),
      ls("Screen door", "One door in the run."),
      { name: "Stain or paint", description: "Floor and trim as quoted.", unit: "sf", slot: "stain" },
    ],
  },
];

export const KIT_SEEDS: Record<string, KitSeed[]> = {
  gutters: GUTTER_KIT_SEED,
  paint: PAINT_KIT_SEED,
  roof: ROOF_KIT_SEED,
  windows: WINDOW_KIT_SEED,
  siding: SIDING_KIT_SEED,
  deck: DECK_KIT_SEED,
  porch: PORCH_KIT_SEED,
};

export function hasKitSeed(workId: string) {
  return Boolean(KIT_SEEDS[workId]?.length);
}

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

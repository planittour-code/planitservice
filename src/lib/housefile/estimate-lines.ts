import { bookLabel, type BookSlotId, type PriceBookItem } from "./book";
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
  photos: string[];
  optionId?: string;
};

type Starter = {
  item: string;
  description: string;
  slot?: BookSlotId;
  qty?: string;
};

const PAINT_INTERIOR: Starter[] = [
  { item: "Protect, mask, and move", description: "Floors, hardware, and furniture. Dust control.", qty: "1" },
  { item: "Walls — two coats", description: "Walls in the rooms on this quote.", slot: "interior_paint", qty: "" },
  { item: "Cleanup and walkthrough", description: "Punch and final walk.", qty: "1" },
];

const PAINT_EXTERIOR: Starter[] = [
  { item: "Scrape, caulk, and prime", description: "Failed film, open joints, bare wood.", qty: "1" },
  { item: "Body — two coats", description: "Siding / elevations on this quote.", slot: "exterior_paint", qty: "" },
];

const ROOF: Starter[] = [
  { item: "Tear-off and haul", description: "Strip existing roof and haul debris.", qty: "" },
  { item: "Ice and water shield", description: "Valleys and eaves.", qty: "" },
  { item: "Synthetic underlayment", description: "Field underlayment.", qty: "" },
  { item: "Shingles", description: "Field shingles from the book.", slot: "shingle", qty: "" },
  { item: "Ridge cap and vent", description: "Cap and exhaust at the ridge.", qty: "" },
  { item: "Flashings and boots", description: "Step, pipe, and wall flashings.", qty: "1" },
  { item: "Permit, dumpster, closeout", description: "Dumpster, permit, magnetic sweep.", qty: "1" },
];

const WINDOWS: Starter[] = [
  { item: "Remove and haul", description: "Pull existing units and haul.", qty: "" },
  { item: "Window units", description: "New units from the book.", slot: "window", qty: "" },
];

const GUTTERS: Starter[] = [
  { item: "Remove existing gutters", description: "Pull and haul old gutters.", qty: "" },
  { item: "Gutters", description: "New gutter run from the book.", slot: "gutter", qty: "" },
  { item: "Downspouts and splash", description: "Downspouts and splash blocks.", qty: "" },
];

const SIDING: Starter[] = [
  { item: "Tear-off and haul", description: "Strip cladding and haul.", qty: "" },
  { item: "Siding", description: "New siding from the book.", slot: "siding", qty: "" },
];

const DECK: Starter[] = [
  { item: "Wash and prep", description: "Clean, dull, and sand as needed.", qty: "" },
  { item: "Stain / sealer", description: "Finish from the book.", slot: "stain", qty: "" },
];

const PORCH: Starter[] = [
  { item: "Prep floor", description: "Clean and dull the walking surface.", qty: "" },
  { item: "Porch floor finish", description: "Floor coat from the book.", slot: "stain", qty: "" },
];

export function startersFor(workId: string, paintScope?: string): Starter[] {
  switch (workId) {
    case "paint":
      return paintScope === "exterior" ? PAINT_EXTERIOR : PAINT_INTERIOR;
    case "roof":
      return ROOF;
    case "windows":
      return WINDOWS;
    case "gutters":
      return GUTTERS;
    case "siding":
      return SIDING;
    case "deck":
      return DECK;
    case "porch":
      return PORCH;
    default:
      return [];
  }
}

export type EstimateOption = {
  id: string;
  label: string;
  hint: string;
  lines: Starter[];
};

export function optionsFor(workId: string, paintScope?: string): EstimateOption[] {
  if (workId === "paint" && paintScope === "exterior") {
    return [
      {
        id: "ext_trim",
        label: "Paint the trim",
        hint: "Fascia, soffit, window casing.",
        lines: [
          { item: "Exterior trim", description: "Fascia, soffit, and casing.", slot: "exterior_trim", qty: "" },
        ],
      },
      {
        id: "front_door",
        label: "Front door",
        hint: "Door and sidelights as an accent.",
        lines: [{ item: "Front door", description: "Door and sidelights.", slot: "door_paint", qty: "1" }],
      },
      {
        id: "shutters",
        label: "Shutters",
        hint: "Remove, prep, and rehang.",
        lines: [
          { item: "Shutters — prep and paint", description: "Remove, paint, and rehang.", qty: "" },
        ],
      },
    ];
  }
  if (workId === "paint") {
    return [
      {
        id: "ceilings",
        label: "Paint ceilings",
        hint: "Flat white in the same rooms.",
        lines: [{ item: "Ceilings", description: "Flat white, same rooms.", qty: "" }],
      },
      {
        id: "trim",
        label: "Paint trim and doors",
        hint: "Casing, base, and doors.",
        lines: [
          { item: "Trim and doors", description: "Casing, base, and doors.", slot: "interior_trim", qty: "" },
        ],
      },
      {
        id: "cabinets",
        label: "Kitchen cabinets",
        hint: "Doors and frames only.",
        lines: [
          { item: "Cabinet doors — prep", description: "Remove, clean, and degloss doors and frames.", qty: "1" },
          { item: "Cabinet doors — two coats", description: "Spray or brush enamel on doors and frames.", qty: "" },
          { item: "Rehang and hardware", description: "Rehang doors and reset pulls.", qty: "1" },
        ],
      },
    ];
  }
  if (workId === "roof") {
    return [
      {
        id: "ridge_vent",
        label: "Ridge vent upgrade",
        hint: "Cut the ridge and add a shingle-over vent.",
        lines: [
          { item: "Ridge vent", description: "Cut-in ridge vent and cap.", qty: "" },
        ],
      },
      {
        id: "skylights",
        label: "Skylight flashing",
        hint: "New kits on existing skylights.",
        lines: [
          { item: "Skylight flashing kits", description: "New flashing kits on existing units.", qty: "" },
        ],
      },
      {
        id: "chimney",
        label: "Chimney cricket / counterflash",
        hint: "Keep water off the back of the chimney.",
        lines: [
          { item: "Chimney cricket", description: "Cricket and counterflash at the chimney.", qty: "1" },
        ],
      },
    ];
  }
  if (workId === "windows") {
    return [
      {
        id: "screens",
        label: "New screens",
        hint: "Full screens on each unit.",
        lines: [{ item: "Screens", description: "New full screens.", qty: "" }],
      },
      {
        id: "interior_trim",
        label: "Interior casing",
        hint: "New casing and stool at each opening.",
        lines: [
          { item: "Interior casing and stool", description: "Trim each opening.", qty: "" },
        ],
      },
      {
        id: "exterior_wrap",
        label: "Exterior wrap and caulk",
        hint: "Tape and seal the new units.",
        lines: [
          { item: "Exterior wrap and caulk", description: "Flange tape and perimeter sealant.", qty: "" },
        ],
      },
    ];
  }
  if (workId === "gutters") {
    return [
      {
        id: "guards",
        label: "Leaf guards",
        hint: "Micromesh on the whole run.",
        lines: [
          { item: "Leaf guards", description: "Guards on the new run.", slot: "gutter_guard", qty: "" },
        ],
      },
      {
        id: "underground",
        label: "Underground drain tie-in",
        hint: "Leaders into existing drains.",
        lines: [
          { item: "Underground drain tie-in", description: "Tie leaders into existing drains.", qty: "" },
        ],
      },
    ];
  }
  if (workId === "siding") {
    return [
      {
        id: "wrap",
        label: "Housewrap",
        hint: "New wrap and tape at openings.",
        lines: [{ item: "Housewrap and tape", description: "Wrap and seam tape.", qty: "" }],
      },
      {
        id: "soffit",
        label: "Soffit and fascia",
        hint: "Replace the eave assembly.",
        lines: [
          { item: "Soffit and fascia", description: "New soffit and fascia at the eaves.", qty: "" },
        ],
      },
    ];
  }
  if (workId === "deck") {
    return [
      {
        id: "rail",
        label: "Stain the rail",
        hint: "Pickets and cap, same product.",
        lines: [{ item: "Rail and pickets", description: "Stain pickets and cap.", qty: "" }],
      },
      {
        id: "boards",
        label: "Replace failed boards",
        hint: "Pull and replace bad decking.",
        lines: [
          { item: "Replace failed boards", description: "Pull and replace failed decking.", qty: "" },
        ],
      },
    ];
  }
  if (workId === "porch") {
    return [
      {
        id: "rail",
        label: "Work the rail",
        hint: "Pickets, cap, and posts.",
        lines: [{ item: "Rail and pickets", description: "Paint or stain the rail.", qty: "" }],
      },
      {
        id: "ceiling",
        label: "Porch ceiling",
        hint: "Beadboard or underside of the deck above.",
        lines: [{ item: "Porch ceiling", description: "Prep and finish the ceiling.", qty: "" }],
      },
      {
        id: "screens",
        label: "Screen panels",
        hint: "For a screened porch.",
        lines: [{ item: "Screen panels", description: "New screen panels.", qty: "" }],
      },
    ];
  }
  return [];
}

export function optionLabel(id: string): string {
  for (const workId of ["paint", "roof", "windows", "gutters", "siding", "deck", "porch"]) {
    for (const scope of ["interior", "exterior"]) {
      const hit = optionsFor(workId, scope).find((o) => o.id === id);
      if (hit) return hit.label;
    }
  }
  return "Optional work";
}

export function linesForOption(
  option: EstimateOption,
  book: PriceBookItem[],
): EstimateLine[] {
  return option.lines.map((row) => {
    const line = starterToLine(row, book);
    return { ...line, optionId: option.id };
  });
}

function starterToLine(row: Starter, book: PriceBookItem[]): EstimateLine {
  const item = row.slot
    ? book.find((b) => b.active !== false && b.slot === row.slot)
    : undefined;
  const base: EstimateLine = {
    id: crypto.randomUUID(),
    bookId: "",
    item: row.item,
    description: row.description,
    qty: row.qty ?? "",
    cost: "",
    price: "",
    photos: [],
  };
  return item ? applyBookToLine({ ...base, description: row.description }, item) : base;
}

export function seedEstimateLines(
  workId: string,
  book: PriceBookItem[],
  paintScope?: string,
): EstimateLine[] {
  const starters = startersFor(workId, paintScope);
  if (starters.length === 0) return [blankEstimateLine()];
  return starters.map((row) => starterToLine(row, book));
}

export function blankEstimateLine(): EstimateLine {
  return {
    id: crypto.randomUUID(),
    bookId: "",
    item: "",
    description: "",
    qty: "1",
    cost: "",
    price: "",
    photos: [],
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
        photos: Array.isArray(r.photos)
          ? r.photos.filter((p): p is string => typeof p === "string" && p.startsWith("data:image/"))
          : [],
        optionId: r.optionId ? String(r.optionId) : undefined,
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
  const extra = [
    item.color ? `Color: ${item.color}` : "",
    item.sku ? `SKU ${item.sku}` : "",
    item.warranty_years ? `${item.warranty_years}-year warranty` : "",
    item.warranty_terms ?? "",
  ]
    .filter(Boolean)
    .join("\n");
  const description = [line.description.trim(), extra].filter(Boolean).join("\n\n");
  return {
    ...line,
    bookId: item.id,
    item: bookLabel(item) || line.item,
    description,
    cost: item.cost != null ? String(item.cost) : line.cost,
    price: item.sell != null ? String(item.sell) : item.cost != null ? String(item.cost) : line.price,
    photos: line.photos ?? [],
  };
}

export function estimateLineReady(line: EstimateLine): boolean {
  return Boolean(line.item.trim()) && num(line.qty) > 0 && String(line.price).trim() !== "";
}

export function estimateReady(lines: EstimateLine[]): boolean {
  return lines.some(estimateLineReady);
}

export function estimatePhotos(lines: EstimateLine[]): { caption: string; src: string }[] {
  const out: { caption: string; src: string }[] = [];
  for (const line of lines) {
    for (const src of line.photos ?? []) {
      if (src.startsWith("data:image/")) out.push({ caption: line.item.trim() || "Line photo", src });
    }
  }
  return out;
}

export function toQuoteLines(lines: EstimateLine[], book: PriceBookItem[]): QuoteLine[] {
  return lines.filter((line) => line.item.trim()).map((line) => {
    const item = book.find((b) => b.id === line.bookId);
    const cost = String(line.cost).trim() === "" ? null : num(line.cost);
    return {
      name: line.item.trim(),
      description: line.description.trim(),
      qty: num(line.qty),
      unit: item?.unit || "ea",
      unit_price: num(line.price),
      optional: Boolean(line.optionId),
      included: num(line.qty) > 0 && String(line.price).trim() !== "",
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
      optionId: line.optionId,
    };
  });
}

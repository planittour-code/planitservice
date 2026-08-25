import { FIELD_BY_KEY, type FieldDef } from "./fields";

export type TakeoffKind = "number" | "text" | "select" | "toggle";

export type TakeoffField = {
  key: string;
  label: string;
  kind: TakeoffKind;
  hint: string;
  unit?: string;
  placeholder?: string;
  fieldKey?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  when?: (inputs: Record<string, string>) => boolean;
};

export type QuoteLine = {
  name: string;
  description: string;
  qty: number;
  unit: string;
  unit_price: number;
  optional: boolean;
  included: boolean;
  category: string;
  manufacturer: string | null;
  product_name: string | null;
  sku: string | null;
  color: string | null;
  warranty_years: number | null;
  warranty_terms: string | null;
  bookSlot?: string;
  bookId?: string;
  unit_cost?: number | null;
  needsCost?: boolean;
};

export type WorkType = {
  id: string;
  templateId: string;
  trade: string;
  name: string;
  blurb: string;
  fields: TakeoffField[];
};

function f(
  key: string,
  label: string,
  kind: TakeoffKind,
  hint: string,
  extra: Partial<TakeoffField> = {},
): TakeoffField {
  const catalog: FieldDef | undefined = extra.fieldKey ? FIELD_BY_KEY[extra.fieldKey] : FIELD_BY_KEY[key];
  return {
    key,
    label,
    kind,
    hint,
    fieldKey: extra.fieldKey ?? (FIELD_BY_KEY[key] ? key : undefined),
    placeholder: extra.placeholder ?? catalog?.placeholder,
    unit: extra.unit,
    options: extra.options,
    required: extra.required,
    when: extra.when,
  };
}

const interior = (i: Record<string, string>) => (i.paint_scope || "interior") !== "exterior";
const exterior = (i: Record<string, string>) => i.paint_scope === "exterior";

export const WORK_TYPES: WorkType[] = [
  {
    id: "paint",
    templateId: "tmpl_int_paint",
    trade: "paint",
    name: "Paint",
    blurb: "Interior or exterior. Rooms, siding, and the colors that stay with the house.",
    fields: [
      f("paint_scope", "Where", "select", "The questions change with the side of the wall.", {
        options: [
          { value: "interior", label: "Interior" },
          { value: "exterior", label: "Exterior" },
        ],
      }),
      f("square_feet", "Floor square feet", "number", "Rooms to paint, or the house size behind the elevations.", {
        unit: "sf",
        required: true,
      }),
      f("stories", "Stories", "number", "Stairs, staging, and fall protection.", { placeholder: "1" }),
      f("occupancy", "Occupancy", "select", "Lived-in houses need dust control and furniture moves.", {
        options: [
          { value: "Primary residence", label: "Lived-in" },
          { value: "Vacant", label: "Vacant" },
        ],
      }),
      f("room_count", "Rooms", "number", "Trim and door count follows the rooms.", {
        unit: "ea",
        required: true,
        when: interior,
      }),
      f("ceiling_height", "Ceiling height", "number", "Taller walls, more gallons and time.", {
        unit: "ft",
        placeholder: "8",
        when: interior,
      }),
      f("interior_paint_main", "Wall color", "text", "Product and color, written down.", { when: interior }),
      f("interior_trim_paint", "Trim color", "text", "Enamel formula and sheen.", { when: interior }),
      f("include_ceilings", "Paint ceilings", "toggle", "Flat white, same rooms.", { when: interior }),
      f("include_trim", "Paint trim and doors", "toggle", "Casing, base, and doors in the rooms.", { when: interior }),
      f("include_cabinets", "Kitchen cabinets", "toggle", "Optional. Doors and frames only.", { when: interior }),
      f("siding_type", "Siding", "select", "Prep time changes with the cladding.", {
        when: exterior,
        options: [
          { value: "Wood clapboard", label: "Wood clapboard" },
          { value: "Fiber-cement", label: "Fiber-cement" },
          { value: "Brick with wood trim", label: "Brick with wood trim" },
          { value: "Stucco", label: "Stucco" },
        ],
      }),
      f("exterior_paint", "Body color", "text", "Color and product so the next coat matches.", { when: exterior }),
      f("exterior_trim_paint", "Trim color", "text", "Fascia, soffit, window casing.", { when: exterior }),
      f("front_door_paint", "Front door color", "text", "Accent colors are easy to lose.", { when: exterior }),
    ],
  },
  {
    id: "roof",
    templateId: "tmpl_roof",
    trade: "roofing",
    name: "Roof",
    blurb: "Squares, pitch, and layers. Waste and access in the number.",
    fields: [
      f("roof_squares", "Roof squares", "number", "Leave blank to estimate from footprint.", {
        unit: "sq",
        placeholder: "24",
      }),
      f("square_feet", "Finished square feet", "number", "Footprint proxy if squares are unknown.", { unit: "sf" }),
      f("stories", "Stories", "number", "Staging and disposal."),
      f("roof_pitch", "Pitch", "select", "Steeper roofs add waste and labor.", {
        options: [
          { value: "4/12", label: "Low — 4/12 or less" },
          { value: "6/12", label: "Average — 6/12" },
          { value: "8/12", label: "Steep — 8/12 or more" },
        ],
      }),
      f("roof_layers", "Layers to tear off", "select", "Second layer is slower.", {
        options: [
          { value: "1", label: "One layer" },
          { value: "2", label: "Two layers" },
        ],
      }),
      f("roof_type", "Existing roof", "text", "Shingle, metal, or something else."),
      f("roof_year", "Roof year", "number", "Age is the first question on a reroof."),
    ],
  },
  {
    id: "windows",
    templateId: "tmpl_windows",
    trade: "windows",
    name: "Windows",
    blurb: "Count, type, and access. Each unit carries its own warranty.",
    fields: [
      f("window_count", "Windows to replace", "number", "Openings in this quote.", { unit: "ea", required: true }),
      f("window_type", "Existing windows", "select", "Wood vs vinyl changes the unit and the install.", {
        options: [
          { value: "Wood divided-lite", label: "Wood" },
          { value: "Vinyl", label: "Vinyl" },
          { value: "Aluminum", label: "Aluminum" },
          { value: "Fiberglass", label: "Fiberglass" },
        ],
      }),
      f("window_year", "Window year", "number", "Helps quote replace vs restore."),
      f("stories", "Stories", "number", "Second-story units need more staging."),
      f("window_product", "New product", "select", "The name that lands in the house file.", {
        options: [
          { value: "Andersen 100 Series", label: "Andersen 100 Series — vinyl" },
          { value: "Pella Impervia", label: "Pella Impervia — fiberglass" },
          { value: "Marvin Essential", label: "Marvin Essential — wood clad" },
        ],
      }),
      f("include_screens", "New screens", "toggle", "Full screens on each unit."),
      f("include_interior_trim", "Interior casing", "toggle", "New casing and stool at each opening."),
    ],
  },
  {
    id: "gutters",
    templateId: "tmpl_gutter",
    trade: "gutters",
    name: "Gutters",
    blurb: "Linear feet of eave, downspouts, and whether guards go on.",
    fields: [
      f("gutter_lf", "Gutter run", "number", "Measure the eaves. Corners are in the unit price.", {
        unit: "lf",
        required: true,
      }),
      f("downspout_count", "Downspouts", "number", "New leaders to grade.", { unit: "ea", placeholder: "4" }),
      f("stories", "Stories", "number", "Two-story runs cost more to hang."),
      f("gutter_type", "Gutter spec", "text", "Size and material."),
      f("exterior_trim_paint", "Color", "text", "Usually matched to the trim."),
      f("include_guards", "Leaf guards", "toggle", "Micromesh on the whole run."),
    ],
  },
  {
    id: "siding",
    templateId: "tmpl_siding",
    trade: "siding",
    name: "Siding",
    blurb: "Elevations, what comes off, and the product that goes back on.",
    fields: [
      f("square_feet", "Finished square feet", "number", "Used to estimate elevation area.", {
        unit: "sf",
        required: true,
      }),
      f("stories", "Stories", "number", "Access and staging.", { required: true }),
      f("siding_type", "Existing siding", "select", "What comes off.", {
        options: [
          { value: "Wood clapboard", label: "Wood clapboard" },
          { value: "Vinyl", label: "Vinyl" },
          { value: "Fiber-cement", label: "Fiber-cement" },
          { value: "Masonite", label: "Hardboard / Masonite" },
        ],
      }),
      f("siding_new", "New siding", "select", "The product that stays with the house.", {
        options: [
          { value: "James Hardie fiber-cement", label: "James Hardie fiber-cement" },
          { value: "Vinyl", label: "Vinyl" },
          { value: "Wood clapboard", label: "Wood clapboard" },
        ],
      }),
      f("exterior_paint", "Body color", "text", "Pre-finished color, or the coat after."),
      f("include_wrap", "Housewrap", "toggle", "New wrap and tape at openings."),
    ],
  },
  {
    id: "deck",
    templateId: "tmpl_deck",
    trade: "decks",
    name: "Decks",
    blurb: "Board area, repairs, and the stain that stays with the house.",
    fields: [
      f("deck_sf", "Deck square feet", "number", "Walking surface only.", { unit: "sf", required: true }),
      f("board_repair_count", "Boards to replace", "number", "Failed decking, each.", { unit: "ea", placeholder: "8" }),
      f("include_rail", "Stain the rail", "toggle", "Pickets and cap, same product."),
      f("stain_color", "Stain color", "text", "The next coat has to match.", { placeholder: "Dark Walnut" }),
    ],
  },
  {
    id: "porch",
    templateId: "tmpl_porch",
    trade: "porches",
    name: "Porches",
    blurb: "Floor, ceiling, screens, and rail — priced from the porch, not the house.",
    fields: [
      f("porch_sf", "Porch square feet", "number", "Floor of this porch.", { unit: "sf", required: true }),
      f("porch_type", "Porch type", "select", "Open, covered, or screened changes the assembly.", {
        options: [
          { value: "open", label: "Open — floor and rail" },
          { value: "covered", label: "Covered — floor, ceiling, rail" },
          { value: "screened", label: "Screened-in" },
        ],
      }),
      f("stories", "Stories", "number", "A second-story porch is a different staging job."),
      f("include_rail", "Work the rail", "toggle", "Pickets, cap, and posts."),
      f("stain_color", "Floor finish", "text", "Stain or paint on the boards.", { placeholder: "Dark Walnut" }),
      f("exterior_trim_paint", "Trim / ceiling color", "text", "Beadboard and posts."),
    ],
  },
];

export const WORK_BY_ID = Object.fromEntries(WORK_TYPES.map((w) => [w.id, w]));

export function workTypesFor(trades: string | null | undefined) {
  const ids = (trades ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return WORK_TYPES;
  const picked = WORK_TYPES.filter((w) => ids.includes(w.id));
  return picked.length ? picked : WORK_TYPES;
}

export function workForTemplate(templateId: string): WorkType | undefined {
  if (templateId === "tmpl_int_paint" || templateId === "tmpl_ext_paint") return WORK_BY_ID.paint;
  return WORK_TYPES.find((w) => w.templateId === templateId);
}

export function templateFor(work: WorkType, inputs: Record<string, string>) {
  if (work.id === "paint" && inputs.paint_scope === "exterior") return "tmpl_ext_paint";
  return work.templateId;
}

export function nInput(inputs: Record<string, string>, key: string, fallback = 0) {
  const raw = inputs[key];
  if (raw == null || raw === "") return fallback;
  const parsed = Number(String(raw).replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function onInput(inputs: Record<string, string>, key: string, fallback = false) {
  const raw = (inputs[key] ?? "").toLowerCase().trim();
  if (!raw) return fallback;
  return raw === "yes" || raw === "true" || raw === "1" || raw === "on";
}

function money(n: number) {
  return Math.round(n * 100) / 100;
}

function line(partial: Omit<QuoteLine, "optional" | "included" | "manufacturer" | "product_name" | "sku" | "color" | "warranty_years" | "warranty_terms"> & Partial<QuoteLine>): QuoteLine {
  return {
    optional: false,
    included: true,
    manufacturer: null,
    product_name: null,
    sku: null,
    color: null,
    warranty_years: null,
    warranty_terms: null,
    ...partial,
    qty: money(partial.qty),
    unit_price: money(partial.unit_price),
  };
}

function wallSf(floorSf: number, stories: number, ceilingFt: number) {
  const height = Math.max(7, ceilingFt || 8);
  const factor = 2.8 * (height / 8);
  return Math.max(0, floorSf * factor * Math.max(1, Math.min(stories, 2.2) / Math.max(stories, 1)));
}

function exteriorWallSf(floorSf: number, stories: number) {
  const st = Math.max(1, stories);
  return Math.round((floorSf / st) * 2.55 * st);
}

function roofSquaresFrom(inputs: Record<string, string>) {
  const given = nInput(inputs, "roof_squares");
  if (given > 0) return given;
  const sf = nInput(inputs, "square_feet");
  const stories = Math.max(1, nInput(inputs, "stories", 1));
  const pitch = inputs.roof_pitch || "6/12";
  const pitchFactor = pitch.startsWith("8") ? 1.25 : pitch.startsWith("4") ? 1.08 : 1.15;
  if (sf <= 0) return 0;
  return Math.round(((sf / stories) * pitchFactor) / 100 * 10) / 10;
}

export function fieldVisible(field: TakeoffField, inputs: Record<string, string>) {
  return !field.when || field.when(inputs);
}

export function defaultsFor(work: WorkType, facts: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of work.fields) {
    const fromFact = field.fieldKey ? facts[field.fieldKey] : facts[field.key];
    if (fromFact) {
      out[field.key] = field.kind === "number" ? String(nInput({ n: fromFact }, "n") || fromFact) : fromFact;
      continue;
    }
    if (field.kind === "toggle") {
      out[field.key] = field.key === "include_cabinets" || field.key === "include_guards" || field.key === "include_rail" ? "yes" : "yes";
      if (field.key === "include_cabinets") out[field.key] = "no";
      if (field.key === "include_guards") out[field.key] = "yes";
      if (field.key === "include_rail") out[field.key] = "yes";
      continue;
    }
    if (field.kind === "select") {
      out[field.key] = field.options?.[0]?.value ?? "";
      continue;
    }
    out[field.key] = field.placeholder ?? "";
    if (field.kind === "number" && out[field.key]) {
      const parsed = nInput({ n: out[field.key] }, "n");
      if (parsed) out[field.key] = String(parsed);
    }
  }
  if (work.id === "paint") {
    if (!out.paint_scope) out.paint_scope = "interior";
    if (!out.include_ceilings) out.include_ceilings = "yes";
    if (!out.include_trim) out.include_trim = "yes";
    if (!out.include_cabinets) out.include_cabinets = "no";
    if (!out.ceiling_height) out.ceiling_height = "8";
    if (!out.occupancy) out.occupancy = "Primary residence";
  }
  if (work.id === "windows") {
    if (!out.include_screens) out.include_screens = "yes";
    if (!out.include_interior_trim) out.include_interior_trim = "yes";
  }
  if (work.id === "siding" && !out.include_wrap) out.include_wrap = "yes";
  if (work.id === "porch" && !out.include_rail) out.include_rail = "yes";
  if (work.id === "gutters" && !out.downspout_count) out.downspout_count = "4";
  if (work.id === "roof" && !out.roof_layers) out.roof_layers = "1";
  if (work.id === "roof" && !out.roof_pitch) out.roof_pitch = "6/12";
  return out;
}

export function buildQuote(workId: string, inputs: Record<string, string>): QuoteLine[] {
  switch (workId) {
    case "paint":
      return inputs.paint_scope === "exterior" ? quoteExterior(inputs) : quoteInterior(inputs);
    case "roof":
      return quoteRoof(inputs);
    case "windows":
      return quoteWindows(inputs);
    case "gutters":
      return quoteGutters(inputs);
    case "siding":
      return quoteSiding(inputs);
    case "deck":
      return quoteDeck(inputs);
    case "porch":
      return quotePorch(inputs);
    default:
      return [];
  }
}

export function quoteTotal(lines: QuoteLine[]) {
  return lines.filter((l) => l.included && l.qty > 0).reduce((s, l) => s + l.qty * l.unit_price, 0);
}

function quoteInterior(inputs: Record<string, string>): QuoteLine[] {
  const sf = nInput(inputs, "square_feet");
  const rooms = Math.max(1, nInput(inputs, "room_count", 4));
  const ceil = nInput(inputs, "ceiling_height", 8);
  const stories = nInput(inputs, "stories", 1);
  const livedIn = (inputs.occupancy || "").toLowerCase().includes("vacant") ? false : true;
  const color = inputs.interior_paint_main || "SW 7029 Agreeable Gray";
  const trimColor = inputs.interior_trim_paint || "SW Extra White, satin";
  const walls = Math.round(wallSf(sf, stories, ceil));
  const prep = 180 + sf * 0.12 + (livedIn ? 90 : 0) + (stories >= 1.5 ? 60 : 0);
  const lines: QuoteLine[] = [
    line({
      name: "Protect, mask, and move",
      description: livedIn
        ? "Floors, hardware, and furniture. Dust control for a lived-in house."
        : "Floors and hardware. Vacant house.",
      qty: 1,
      unit: "ls",
      unit_price: Math.max(220, prep),
      category: "prep",
    }),
    line({
      name: "Walls — two coats",
      description: `${walls.toLocaleString()} sf of wall at ${ceil} ft ceilings across ${rooms} rooms.`,
      qty: walls,
      unit: "sf",
      unit_price: ceil >= 9 ? 2.05 : 1.9,
      category: "paint",
      manufacturer: "Sherwin-Williams",
      product_name: "Cashmere",
      sku: color.includes("SW") ? color.split(" ").slice(0, 2).join(" ") : null,
      color,
      warranty_terms: "Lifetime washability of the film when applied per spec.",
    }),
  ];
  if (onInput(inputs, "include_ceilings", true)) {
    lines.push(
      line({
        name: "Ceilings",
        description: "Flat white, same rooms.",
        qty: sf,
        unit: "sf",
        unit_price: 0.85,
        category: "paint",
        manufacturer: "Sherwin-Williams",
        product_name: "ProMar 200",
        color: "Ceiling Bright White",
      }),
    );
  }
  if (onInput(inputs, "include_trim", true)) {
    lines.push(
      line({
        name: "Interior trim enamel",
        description: "Doors, casing, and base. Satin.",
        qty: rooms,
        unit: "room",
        unit_price: 95,
        category: "paint",
        manufacturer: "Sherwin-Williams",
        product_name: "Emerald Urethane",
        color: trimColor,
        warranty_years: 15,
        warranty_terms: "15-year film warranty.",
      }),
    );
  }
  lines.push(
    line({
      name: "Kitchen cabinet enamel",
      description: "Doors and frames, two coats. New pulls not included.",
      qty: 1,
      unit: "ls",
      unit_price: 1800,
      optional: true,
      included: onInput(inputs, "include_cabinets", false),
      category: "paint",
      manufacturer: "Sherwin-Williams",
      product_name: "Emerald Urethane",
      color,
      warranty_years: 15,
      warranty_terms: "15-year film warranty.",
    }),
  );
  return lines.filter((l) => l.qty > 0);
}

function quoteExterior(inputs: Record<string, string>): QuoteLine[] {
  const sf = nInput(inputs, "square_feet");
  const stories = Math.max(1, nInput(inputs, "stories", 1));
  const siding = inputs.siding_type || "Wood clapboard";
  const painted = exteriorWallSf(sf, stories);
  const wood = /wood|clapboard|cedar/i.test(siding);
  const brick = /brick/i.test(siding);
  const prepRate = wood ? 0.42 : brick ? 0.18 : 0.28;
  const bodyRate = wood ? 1.45 : brick ? 0.55 : 1.25;
  const bodyColor = inputs.exterior_paint || "SW 7008 Alabaster";
  const trimColor = inputs.exterior_trim_paint || "SW Extra White";
  const doorColor = inputs.front_door_paint || "SW 2801 Rookwood Red";
  const livedIn = !(inputs.occupancy || "").toLowerCase().includes("vacant");
  return [
    line({
      name: "Prep, scrape, caulk, prime",
      description: `${siding}. Failed film, open joints, spot prime.${livedIn ? " Lived-in house." : ""}`,
      qty: 1,
      unit: "ls",
      unit_price: Math.max(480, 320 + painted * prepRate + (livedIn ? 120 : 0) + (stories >= 2 ? 180 : 0)),
      category: "prep",
    }),
    line({
      name: "Body",
      description: `Two coats, spray and back-brush. About ${painted.toLocaleString()} sf of elevation.`,
      qty: painted,
      unit: "sf",
      unit_price: bodyRate,
      category: "paint",
      manufacturer: "Sherwin-Williams",
      product_name: "Duration Exterior",
      color: bodyColor,
      warranty_years: 15,
      warranty_terms: "15-year film warranty.",
    }),
    line({
      name: "Trim and fascia",
      description: "Two coats, brush and roll.",
      qty: Math.max(1, Math.round(painted * 0.18)),
      unit: "sf",
      unit_price: 2.4,
      category: "paint",
      manufacturer: "Sherwin-Williams",
      product_name: "Duration Exterior",
      color: trimColor,
      warranty_years: 15,
      warranty_terms: "15-year film warranty.",
    }),
    line({
      name: "Front door enamel",
      description: "Sand, prime, two coats.",
      qty: 1,
      unit: "ea",
      unit_price: 220,
      category: "paint",
      manufacturer: "Sherwin-Williams",
      product_name: "Emerald Urethane",
      sku: "SW 2801",
      color: doorColor,
      warranty_years: 15,
      warranty_terms: "15-year film warranty.",
    }),
    line({
      name: "Cleanup and walkthrough",
      description: "Hardware, punch, final walk.",
      qty: 1,
      unit: "ls",
      unit_price: 180,
      category: "closeout",
    }),
  ];
}

function quoteRoof(inputs: Record<string, string>): QuoteLine[] {
  const squares = roofSquaresFrom(inputs);
  const layers = Math.max(1, nInput(inputs, "roof_layers", 1));
  const pitch = inputs.roof_pitch || "6/12";
  const steep = pitch.startsWith("8") ? 1.18 : pitch.startsWith("4") ? 1 : 1.08;
  const stories = nInput(inputs, "stories", 1);
  const access = stories >= 2 ? 1.08 : 1;
  const tear = (layers === 2 ? 130 : 90) * steep * access;
  const shingle = 300 * steep;
  return [
    line({
      name: "Tear-off and haul",
      description: `${layers} layer${layers > 1 ? "s" : ""}, dumpster, magnetic sweep. ${pitch} pitch.`,
      qty: squares,
      unit: "sq",
      unit_price: tear,
      category: "tearoff",
    }),
    line({
      name: "Ice and water shield",
      description: "Eaves, valleys, penetrations.",
      qty: 1,
      unit: "ls",
      unit_price: Math.max(420, squares * 24),
      category: "underlayment",
      manufacturer: "CertainTeed",
      product_name: "WinterGuard",
      warranty_years: 25,
      warranty_terms: "25-year product warranty.",
    }),
    line({
      name: "Synthetic underlayment",
      description: "Full deck.",
      qty: squares,
      unit: "sq",
      unit_price: 20,
      category: "underlayment",
      manufacturer: "GAF",
      product_name: "FeltBuster",
    }),
    line({
      name: "Architectural shingles",
      description: "Full roof, including starter. Waste in the squares.",
      qty: squares,
      unit: "sq",
      unit_price: shingle,
      category: "shingle",
      manufacturer: "GAF",
      product_name: "Timberline HDZ",
      color: "Charcoal",
      sku: "Charcoal",
      warranty_years: 50,
      warranty_terms: "50-year limited warranty. Golden Pledge available.",
    }),
    line({
      name: "Ridge cap and vent",
      description: "Hip and ridge, intake as needed.",
      qty: 1,
      unit: "ls",
      unit_price: Math.max(380, squares * 18),
      category: "vent",
      manufacturer: "GAF",
      product_name: "TimberTex / Cobra",
      color: "Charcoal",
      warranty_years: 50,
      warranty_terms: "Covered with shingle warranty.",
    }),
    line({
      name: "Flashings and boots",
      description: "Drip edge, step, pipe boots.",
      qty: 1,
      unit: "ls",
      unit_price: Math.max(280, squares * 14),
      category: "flashing",
    }),
    line({
      name: "Permit, dumpster, closeout",
      description: "City permit and final photos.",
      qty: 1,
      unit: "ls",
      unit_price: 410 + (stories >= 2 ? 90 : 0),
      category: "closeout",
    }),
  ].filter((l) => l.qty > 0);
}

function quoteGutters(inputs: Record<string, string>): QuoteLine[] {
  const lf = nInput(inputs, "gutter_lf");
  const downs = Math.max(1, nInput(inputs, "downspout_count", 4));
  const stories = nInput(inputs, "stories", 1);
  const hang = stories >= 2 ? 14 : 12;
  const color = inputs.exterior_trim_paint || "White";
  const spec = inputs.gutter_type || "6-inch aluminum";
  const guards = onInput(inputs, "include_guards", true);
  return [
    line({
      name: "Remove existing gutters",
      description: "Haul-off included.",
      qty: 1,
      unit: "ls",
      unit_price: 180 + lf * 0.7,
      category: "demo",
    }),
    line({
      name: spec,
      description: "Seamless, color-matched.",
      qty: lf,
      unit: "lf",
      unit_price: hang,
      category: "gutter",
      manufacturer: "LeafFilter",
      product_name: spec,
      color,
      warranty_years: 25,
      warranty_terms: "25-year finish warranty.",
    }),
    line({
      name: "Leaf guards",
      description: "Micromesh, whole run.",
      qty: lf,
      unit: "lf",
      unit_price: 18,
      optional: true,
      included: guards,
      category: "guard",
      manufacturer: "LeafFilter",
      product_name: "Micromesh",
      warranty_terms: "Limited lifetime clog-free warranty.",
    }),
    line({
      name: "Downspouts and splash",
      description: "New leaders to grade.",
      qty: downs,
      unit: "ea",
      unit_price: 85,
      category: "downspout",
      color,
    }),
  ].filter((l) => l.qty > 0);
}

function quoteWindows(inputs: Record<string, string>): QuoteLine[] {
  const count = nInput(inputs, "window_count");
  const stories = nInput(inputs, "stories", 1);
  const product = inputs.window_product || "Andersen 100 Series";
  const existing = inputs.window_type || "Existing windows";
  const year = inputs.window_year;
  const wood = /marvin|wood/i.test(product) || /wood/i.test(existing);
  const unit = wood ? 1180 : /pella/i.test(product) ? 940 : 720;
  const access = stories >= 2 ? 1.12 : 1;
  const maker = product.split(" ")[0] || "Andersen";
  return [
    line({
      name: "Remove and haul",
      description: `${existing}${year ? `, ${year}` : ""}. Openings covered same day.`,
      qty: count,
      unit: "ea",
      unit_price: 55 * access,
      category: "demo",
    }),
    line({
      name: product,
      description: "Unit, flashing, and install. Low-E glass.",
      qty: count,
      unit: "ea",
      unit_price: unit * access,
      category: "window",
      manufacturer: maker,
      product_name: product,
      warranty_years: 20,
      warranty_terms: "20-year glass. 10-year hardware when registered.",
    }),
    line({
      name: "Interior casing and stool",
      description: "New casing at each opening.",
      qty: count,
      unit: "ea",
      unit_price: 95,
      optional: true,
      included: onInput(inputs, "include_interior_trim", true),
      category: "trim",
    }),
    line({
      name: "Screens",
      description: "Full screens, each unit.",
      qty: count,
      unit: "ea",
      unit_price: 65,
      optional: true,
      included: onInput(inputs, "include_screens", true),
      category: "screen",
      manufacturer: maker,
      product_name: "Full screen",
    }),
  ].filter((l) => l.qty > 0);
}

function quoteSiding(inputs: Record<string, string>): QuoteLine[] {
  const sf = nInput(inputs, "square_feet");
  const stories = Math.max(1, nInput(inputs, "stories", 1));
  const elev = exteriorWallSf(sf, stories);
  const existing = inputs.siding_type || "Existing siding";
  const next = inputs.siding_new || "James Hardie fiber-cement";
  const color = inputs.exterior_paint || "Arctic White";
  const hardie = /hardie|fiber/i.test(next);
  const vinyl = /vinyl/i.test(next);
  const rate = hardie ? 9.4 : vinyl ? 5.6 : 11.2;
  const maker = hardie ? "James Hardie" : vinyl ? "CertainTeed" : "Maibec";
  const wrap = onInput(inputs, "include_wrap", true);
  return [
    line({
      name: "Tear-off and haul",
      description: `${existing} off. Dumpster and magnetic sweep.`,
      qty: elev,
      unit: "sf",
      unit_price: 1.45 * (stories >= 2 ? 1.1 : 1),
      category: "demo",
    }),
    line({
      name: "Housewrap and tape",
      description: "Weather barrier at the elevations and openings.",
      qty: elev,
      unit: "sf",
      unit_price: 0.85,
      optional: true,
      included: wrap,
      category: "wrap",
      manufacturer: "Dupont",
      product_name: "Tyvek",
      warranty_years: 10,
      warranty_terms: "10-year product warranty.",
    }),
    line({
      name: next,
      description: `About ${elev.toLocaleString()} sf of elevation.`,
      qty: elev,
      unit: "sf",
      unit_price: rate,
      category: "siding",
      manufacturer: maker,
      product_name: next,
      color,
      warranty_years: hardie ? 30 : vinyl ? 25 : 15,
      warranty_terms: hardie
        ? "30-year substrate. Color Plus 15-year finish."
        : vinyl
          ? "25-year fade and hail."
          : "15-year finish with stain maintenance.",
    }),
    line({
      name: "Trim, corners, and caulk",
      description: "Outside corners, windows, and doors.",
      qty: Math.max(1, Math.round(elev * 0.12)),
      unit: "sf",
      unit_price: 8.4,
      category: "trim",
      manufacturer: maker,
      color,
    }),
  ].filter((l) => l.qty > 0);
}

function quotePorch(inputs: Record<string, string>): QuoteLine[] {
  const sf = nInput(inputs, "porch_sf");
  const kind = inputs.porch_type || "open";
  const color = inputs.stain_color || "Dark Walnut";
  const trim = inputs.exterior_trim_paint || "SW Extra White";
  const rail = onInput(inputs, "include_rail", true);
  const covered = kind === "covered" || kind === "screened";
  const screened = kind === "screened";
  const lines: QuoteLine[] = [
    line({
      name: "Wash, scrape, and prep",
      description: "Floor, posts, and failed film.",
      qty: 1,
      unit: "ls",
      unit_price: Math.max(240, sf * 1.1),
      category: "prep",
    }),
    line({
      name: "Porch floor",
      description: "Two coats, boards and nosing.",
      qty: sf,
      unit: "sf",
      unit_price: 4.2,
      category: "floor",
      manufacturer: "Ready Seal",
      product_name: "Ready Seal",
      color,
      warranty_years: 3,
      warranty_terms: "3-year maintenance coat recommended.",
    }),
  ];
  if (covered) {
    lines.push(
      line({
        name: "Ceiling and beams",
        description: "Beadboard or existing ceiling, two coats.",
        qty: sf,
        unit: "sf",
        unit_price: 3.1,
        category: "ceiling",
        manufacturer: "Sherwin-Williams",
        product_name: "Duration Exterior",
        color: trim,
        warranty_years: 15,
        warranty_terms: "15-year film warranty.",
      }),
    );
  }
  if (screened) {
    lines.push(
      line({
        name: "Screen panels",
        description: "Fiberglass mesh in aluminum frames.",
        qty: sf,
        unit: "sf",
        unit_price: 12,
        category: "screen",
        manufacturer: "Phifer",
        product_name: "BetterVue",
        warranty_years: 10,
        warranty_terms: "10-year screen warranty.",
      }),
    );
  }
  lines.push(
    line({
      name: "Rail and posts",
      description: "Same finish as the floor, pickets and cap.",
      qty: 1,
      unit: "ls",
      unit_price: Math.max(180, sf * 1.4),
      optional: true,
      included: rail,
      category: "rail",
      color,
    }),
  );
  return lines.filter((l) => l.qty > 0);
}

function quoteDeck(inputs: Record<string, string>): QuoteLine[] {
  const sf = nInput(inputs, "deck_sf");
  const boards = nInput(inputs, "board_repair_count", 8);
  const color = inputs.stain_color || "Dark Walnut";
  const rail = onInput(inputs, "include_rail", true);
  return [
    line({
      name: "Wash and brighten",
      description: "Sodium percarbonate wash, neutralize.",
      qty: 1,
      unit: "ls",
      unit_price: Math.max(220, sf * 0.85),
      category: "prep",
    }),
    line({
      name: "Board repair",
      description: "Replace failed decking.",
      qty: Math.max(0, boards),
      unit: "ea",
      unit_price: 32,
      category: "repair",
    }),
    line({
      name: "Transparent stain",
      description: "Two coats, brush and pad.",
      qty: sf,
      unit: "sf",
      unit_price: 3.4,
      category: "stain",
      manufacturer: "Ready Seal",
      product_name: "Ready Seal",
      color,
      sku: color,
      warranty_years: 3,
      warranty_terms: "3-year maintenance coat recommended.",
    }),
    line({
      name: "Rail touch-up",
      description: "Same stain, pickets and cap.",
      qty: 1,
      unit: "ls",
      unit_price: Math.max(140, sf * 0.45),
      optional: true,
      included: rail,
      category: "stain",
      manufacturer: "Ready Seal",
      product_name: "Ready Seal",
      color,
    }),
  ].filter((l) => l.qty > 0);
}

export function factsFromTakeoff(work: WorkType, inputs: Record<string, string>) {
  const facts: { fieldKey: string; value: string }[] = [];
  for (const field of work.fields) {
    if (!fieldVisible(field, inputs)) continue;
    const key = field.fieldKey;
    if (!key) continue;
    const value = (inputs[field.key] ?? "").trim();
    if (!value) continue;
    if (field.kind === "toggle") continue;
    facts.push({ fieldKey: key, value });
  }
  return facts;
}

export function takeoffReady(work: WorkType, inputs: Record<string, string>) {
  const requiredOk = work.fields
    .filter((f) => f.required && fieldVisible(f, inputs))
    .every(
      (f) =>
        String(inputs[f.key] ?? "").trim() !== "" &&
        (f.kind !== "number" || nInput(inputs, f.key) > 0),
    );
  if (work.id === "roof") {
    return requiredOk && (nInput(inputs, "roof_squares") > 0 || nInput(inputs, "square_feet") > 0);
  }
  return requiredOk;
}

export function suggestedSquares(inputs: Record<string, string>) {
  return roofSquaresFrom(inputs);
}

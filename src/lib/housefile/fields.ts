export type FieldGroup =
  | "house"
  | "paint"
  | "roof"
  | "windows"
  | "gutters"
  | "siding"
  | "decks"
  | "porches"
  | "systems";

export type FieldDef = {
  key: string;
  label: string;
  group: FieldGroup;
  hint: string;
  placeholder: string;
};

export const FIELD_GROUPS: { id: FieldGroup; label: string; blurb: string; photo: string }[] = [
  {
    id: "house",
    label: "The house",
    blurb: "Stories, year, lot size, square footage, and rooms. This helps quote.",
    photo: "/houses/cat-house.jpg",
  },
  {
    id: "paint",
    label: "Paint",
    blurb: "Interior rooms and exterior colors that stay with the house.",
    photo: "/houses/cat-paint.jpg",
  },
  {
    id: "roof",
    label: "Roof",
    blurb: "Squares, pitch, layers, and what is on it now.",
    photo: "/houses/cat-roof.jpg",
  },
  {
    id: "windows",
    label: "Windows",
    blurb: "Count, type, year, and the product that was installed.",
    photo: "/houses/cat-windows.jpg",
  },
  {
    id: "gutters",
    label: "Gutters",
    blurb: "Eave run, downspouts, size, and material.",
    photo: "/houses/cat-gutters.jpg",
  },
  {
    id: "siding",
    label: "Siding",
    blurb: "What is on the elevations and what went on last.",
    photo: "/houses/cat-siding.jpg",
  },
  {
    id: "decks",
    label: "Decks",
    blurb: "Walking surface and the stain that has to match.",
    photo: "/houses/cat-decks.jpg",
  },
  {
    id: "porches",
    label: "Porches",
    blurb: "Floor area and whether it is open, covered, or screened.",
    photo: "/houses/cat-porches.jpg",
  },
  {
    id: "systems",
    label: "Systems",
    blurb: "HVAC, water heater, electrical, and attic — not a takeoff, but the next shop asks.",
    photo: "/houses/cat-systems.jpg",
  },
];

/** Same photos as FIELD_GROUPS, keyed for estimating work ids (deck / porch) too. */
export const CATEGORY_PHOTO: Record<string, string> = {
  house: "/houses/cat-house.jpg",
  paint: "/houses/cat-paint.jpg",
  roof: "/houses/cat-roof.jpg",
  windows: "/houses/cat-windows.jpg",
  gutters: "/houses/cat-gutters.jpg",
  siding: "/houses/cat-siding.jpg",
  decks: "/houses/cat-decks.jpg",
  deck: "/houses/cat-decks.jpg",
  porches: "/houses/cat-porches.jpg",
  porch: "/houses/cat-porches.jpg",
  flooring: "/houses/cat-house.jpg",
  systems: "/houses/cat-systems.jpg",
};

/** Homeowner “The house” quote helpers — shown first, and this helps quote. */
export const HOUSE_QUOTE_KEYS = ["stories", "year_built", "lot_size", "square_feet"] as const;

export const HOUSE_ROOMS_JSON_KEY = "house_rooms";

export const HOUSE_ROOM_COUNT_FIELDS = [
  { key: "room_count", label: "Rooms", placeholder: "6" },
  { key: "toilets", label: "Toilets", placeholder: "2" },
  { key: "sinks", label: "Sinks", placeholder: "3" },
  { key: "closets", label: "Closets", placeholder: "4" },
  { key: "foyer", label: "Foyer", placeholder: "1" },
  { key: "mud_room", label: "Mud room", placeholder: "1" },
] as const;

export const HOUSE_YESNO_FIELDS = [
  { key: "basement", label: "Basement" },
  { key: "attic", label: "Attic" },
] as const;

export const HOUSE_ROOM_EDITOR_KEYS = [
  ...HOUSE_ROOM_COUNT_FIELDS.map((f) => f.key),
  ...HOUSE_YESNO_FIELDS.map((f) => f.key),
  HOUSE_ROOMS_JSON_KEY,
] as const;

export type HouseRoomKind = "room" | "foyer" | "mud_room" | "basement" | "attic";

export type HouseRoomFloor = {
  id: string;
  kind: HouseRoomKind;
  name: string;
  flooring: string;
  stain: string;
  photo: string;
};

export type HouseRoomsPayload = { items: HouseRoomFloor[] };

export function emptyHouseRoom(kind: HouseRoomKind, name: string, id: string): HouseRoomFloor {
  return { id, kind, name, flooring: "", stain: "", photo: "" };
}

export function parseHouseRooms(raw: string | undefined | null): HouseRoomFloor[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as HouseRoomsPayload | HouseRoomFloor[];
    const items = Array.isArray(parsed) ? parsed : parsed.items;
    if (!Array.isArray(items)) return [];
    return items
      .filter((row) => row && typeof row === "object")
      .map((row, i) => ({
        id: String(row.id || `room-${i + 1}`),
        kind: (row.kind as HouseRoomKind) || "room",
        name: String(row.name || `Room ${i + 1}`),
        flooring: String(row.flooring || ""),
        stain: String(row.stain || ""),
        photo: String(row.photo || ""),
      }));
  } catch {
    return [];
  }
}

function countFromFact(value: string | undefined, fallback = 0) {
  const n = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(20, n);
}

export function roomsFromCounts(input: {
  rooms: string | undefined;
  foyer: string | undefined;
  mudRoom: string | undefined;
  basement: string | undefined;
  attic: string | undefined;
  existing: HouseRoomFloor[];
}): HouseRoomFloor[] {
  const byKind = new Map<HouseRoomKind, HouseRoomFloor[]>();
  for (const row of input.existing) {
    const list = byKind.get(row.kind) ?? [];
    list.push(row);
    byKind.set(row.kind, list);
  }
  const take = (kind: HouseRoomKind, count: number, nameFor: (i: number) => string) => {
    const prior = byKind.get(kind) ?? [];
    return Array.from({ length: count }, (_, i) => {
      const prev = prior[i];
      const name = nameFor(i);
      return prev ? { ...prev, name: prev.name.trim() || name } : emptyHouseRoom(kind, name, `${kind}-${i + 1}`);
    });
  };
  return [
    ...take("room", countFromFact(input.rooms, 0), (i) => `Room ${i + 1}`),
    ...take("foyer", countFromFact(input.foyer), (i) => (i === 0 ? "Foyer" : `Foyer ${i + 1}`)),
    ...take("mud_room", countFromFact(input.mudRoom), (i) => (i === 0 ? "Mud room" : `Mud room ${i + 1}`)),
    ...take("basement", input.basement === "yes" ? 1 : 0, () => "Basement"),
    ...take("attic", input.attic === "yes" ? 1 : 0, () => "Attic"),
  ];
}

export const FIELD_CATALOG: FieldDef[] = [
  {
    key: "stories",
    label: "Stories",
    group: "house",
    hint: "This helps quote — access, staging, and fall protection.",
    placeholder: "1.5",
  },
  {
    key: "year_built",
    label: "Year",
    group: "house",
    hint: "This helps quote — ages labor and material.",
    placeholder: "1924",
  },
  {
    key: "lot_size",
    label: "Lot size",
    group: "house",
    hint: "This helps quote — access, dumpsters, and landscaping.",
    placeholder: "0.28 acre",
  },
  {
    key: "square_feet",
    label: "Square footage",
    group: "house",
    hint: "This helps quote — paint, flooring, roof footprint, and HVAC.",
    placeholder: "1840",
  },
  {
    key: "room_count",
    label: "Rooms",
    group: "house",
    hint: "How many rooms to take off. This helps quote.",
    placeholder: "6",
  },
  {
    key: "toilets",
    label: "Toilets",
    group: "house",
    hint: "Count of toilets on the property.",
    placeholder: "2",
  },
  {
    key: "sinks",
    label: "Sinks",
    group: "house",
    hint: "Kitchen, bath, and utility sinks.",
    placeholder: "3",
  },
  {
    key: "closets",
    label: "Closets",
    group: "house",
    hint: "Count of closets.",
    placeholder: "4",
  },
  {
    key: "foyer",
    label: "Foyer",
    group: "house",
    hint: "How many foyers. Leave blank if none.",
    placeholder: "1",
  },
  {
    key: "mud_room",
    label: "Mud room",
    group: "house",
    hint: "How many mud rooms. Leave blank if none.",
    placeholder: "1",
  },
  {
    key: "basement",
    label: "Basement",
    group: "house",
    hint: "Yes or no. This helps quote access and flooring.",
    placeholder: "yes",
  },
  {
    key: "attic",
    label: "Attic",
    group: "house",
    hint: "Yes or no. This helps quote access and flooring.",
    placeholder: "yes",
  },
  {
    key: "house_rooms",
    label: "Room flooring",
    group: "house",
    hint: "Flooring, stain, and a photo of the color in each room.",
    placeholder: "",
  },
  {
    key: "foundation_type",
    label: "Foundation",
    group: "house",
    hint: "Crawlspace vs slab changes plumbing and HVAC.",
    placeholder: "Brick pier crawlspace",
  },
  {
    key: "occupancy",
    label: "Occupancy",
    group: "house",
    hint: "Lived-in homes need dust control and timing.",
    placeholder: "Primary residence",
  },
  {
    key: "driveway_type",
    label: "Driveway",
    group: "house",
    hint: "Protect or replace.",
    placeholder: "Concrete",
  },
  {
    key: "fence",
    label: "Fence",
    group: "house",
    hint: "Material and height.",
    placeholder: "Cedar privacy, 6 ft",
  },
  {
    key: "hoa_name",
    label: "HOA",
    group: "house",
    hint: "Color and material rules live here.",
    placeholder: "Maple Park Civic",
  },
  {
    key: "hoa_rules",
    label: "HOA notes",
    group: "house",
    hint: "Approved colors, notice windows.",
    placeholder: "Earth tones only; 14-day notice",
  },
  {
    key: "flooring_main",
    label: "Main flooring",
    group: "house",
    hint: "Species, finish, or product. This helps quote.",
    placeholder: "White oak, site-finished",
  },
  {
    key: "flooring_new",
    label: "New flooring",
    group: "house",
    hint: "The product a flooring shop would put down.",
    placeholder: "Hardwood",
  },
  {
    key: "flooring_color",
    label: "Floor color / stain",
    group: "house",
    hint: "Berber color or hardwood stain.",
    placeholder: "Sandstone berber, Early American stain",
  },

  {
    key: "ceiling_height",
    label: "Ceiling height",
    group: "paint",
    hint: "Changes scaffold and paint yield.",
    placeholder: "9 ft",
  },
  {
    key: "interior_paint_main",
    label: "Wall color",
    group: "paint",
    hint: "Product and color, written down.",
    placeholder: "SW 7029 Agreeable Gray",
  },
  {
    key: "interior_trim_paint",
    label: "Interior trim",
    group: "paint",
    hint: "Enamel formula and sheen.",
    placeholder: "SW Extra White, satin",
  },
  {
    key: "exterior_paint",
    label: "Body color",
    group: "paint",
    hint: "Color and product, so the next coat matches.",
    placeholder: "SW 7008 Alabaster",
  },
  {
    key: "exterior_trim_paint",
    label: "Exterior trim color",
    group: "paint",
    hint: "Fascia, soffit, window casing.",
    placeholder: "SW Extra White",
  },
  {
    key: "front_door_paint",
    label: "Front door color",
    group: "paint",
    hint: "Accent colors are easy to lose.",
    placeholder: "SW 2801 Rookwood Red",
  },

  {
    key: "roof_type",
    label: "Existing roof",
    group: "roof",
    hint: "Shingle, metal, slate — the starting assembly.",
    placeholder: "Architectural shingle",
  },
  {
    key: "roof_year",
    label: "Roof year",
    group: "roof",
    hint: "Age is the first question on a reroof quote.",
    placeholder: "2019",
  },
  {
    key: "roof_squares",
    label: "Roof squares",
    group: "roof",
    hint: "100 sq ft per square, including waste.",
    placeholder: "24",
  },
  {
    key: "roof_pitch",
    label: "Pitch",
    group: "roof",
    hint: "Access and waste factor.",
    placeholder: "6/12",
  },
  {
    key: "roof_layers",
    label: "Layers",
    group: "roof",
    hint: "How many layers came off last time.",
    placeholder: "1",
  },

  {
    key: "window_count",
    label: "Window count",
    group: "windows",
    hint: "Openings on the last window quote.",
    placeholder: "12",
  },
  {
    key: "window_type",
    label: "Existing windows",
    group: "windows",
    hint: "Wood vs vinyl changes painting and replacement.",
    placeholder: "Wood divided-lite",
  },
  {
    key: "window_year",
    label: "Window year",
    group: "windows",
    hint: "Helps quote replacement vs restore.",
    placeholder: "1998",
  },
  {
    key: "window_product",
    label: "Window product",
    group: "windows",
    hint: "What was installed, with the warranty.",
    placeholder: "Andersen 100 Series",
  },

  {
    key: "gutter_lf",
    label: "Gutter run",
    group: "gutters",
    hint: "Linear feet of eave.",
    placeholder: "140",
  },
  {
    key: "downspout_count",
    label: "Downspouts",
    group: "gutters",
    hint: "Leaders to grade.",
    placeholder: "4",
  },
  {
    key: "gutter_type",
    label: "Gutter spec",
    group: "gutters",
    hint: "Size, material, and guards.",
    placeholder: "6-inch aluminum with guards",
  },

  {
    key: "siding_type",
    label: "Existing siding",
    group: "siding",
    hint: "Clapboard, brick, fiber-cement change prep.",
    placeholder: "Wood clapboard",
  },
  {
    key: "siding_new",
    label: "Siding product",
    group: "siding",
    hint: "What went on last, so the next elevation matches.",
    placeholder: "James Hardie fiber-cement",
  },

  {
    key: "deck_sf",
    label: "Deck square feet",
    group: "decks",
    hint: "Walking surface for stain and boards.",
    placeholder: "320",
  },
  {
    key: "stain_color",
    label: "Deck stain",
    group: "decks",
    hint: "The next coat has to match.",
    placeholder: "Dark Walnut",
  },

  {
    key: "porch_sf",
    label: "Porch square feet",
    group: "porches",
    hint: "Floor of the porch.",
    placeholder: "180",
  },
  {
    key: "porch_type",
    label: "Porch type",
    group: "porches",
    hint: "Open, covered, or screened.",
    placeholder: "covered",
  },

  {
    key: "hvac_type",
    label: "HVAC type",
    group: "systems",
    hint: "Split, heat pump, or boiler.",
    placeholder: "Gas furnace + A/C",
  },
  {
    key: "hvac_year",
    label: "HVAC year",
    group: "systems",
    hint: "Age is the quote.",
    placeholder: "2016",
  },
  {
    key: "hvac_brand",
    label: "HVAC brand",
    group: "systems",
    hint: "Parts and warranty lookup.",
    placeholder: "Carrier",
  },
  {
    key: "hvac_tons",
    label: "HVAC tons",
    group: "systems",
    hint: "Sized from the last load calc.",
    placeholder: "2.5",
  },
  {
    key: "water_heater_type",
    label: "Water heater",
    group: "systems",
    hint: "Tank, tankless, or hybrid.",
    placeholder: "50-gal gas tank",
  },
  {
    key: "water_heater_year",
    label: "Water heater year",
    group: "systems",
    hint: "Most last 8–12 years.",
    placeholder: "2018",
  },
  {
    key: "electrical_panel",
    label: "Electrical panel",
    group: "systems",
    hint: "Brand and condition matter for permits.",
    placeholder: "Square D",
  },
  {
    key: "electrical_amps",
    label: "Service amps",
    group: "systems",
    hint: "Needed for HVAC and EV quotes.",
    placeholder: "200",
  },
  {
    key: "attic_insulation",
    label: "Attic insulation",
    group: "systems",
    hint: "R-value and type.",
    placeholder: "R-30 cellulose",
  },
];

export const FIELD_BY_KEY = Object.fromEntries(FIELD_CATALOG.map((f) => [f.key, f]));

export const PHOTO_CATEGORIES = [
  { id: "exterior", label: "Exterior" },
  { id: "roof", label: "Roof" },
  { id: "interior", label: "Interior" },
  { id: "flooring", label: "Flooring / color" },
  { id: "product", label: "Product / color" },
  { id: "damage", label: "Damage" },
  { id: "general", label: "General" },
] as const;

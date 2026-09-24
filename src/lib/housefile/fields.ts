export type FieldGroup =
  | "house"
  | "paint"
  | "roof"
  | "windows"
  | "gutters"
  | "siding"
  | "decks"
  | "porches"
  | "systems"
  | "plumbing"
  | "pool"
  | "lawn";

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
    label: "Exterior Paint",
    blurb: "Body, trim, and front door colors that stay with the house.",
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
    blurb: "HVAC, water heater, electrical, attic, and appliances — washer and dryer, dishwasher, refrigerator, oven, ice maker.",
    photo: "/houses/cat-systems.jpg",
  },
  {
    id: "plumbing",
    label: "Plumbing",
    blurb: "Fixtures, leaks, drains, and the water heater.",
    photo: "/houses/cat-systems.jpg",
  },
  {
    id: "pool",
    label: "Pool service",
    blurb: "Type, year, and the equipment on this pool.",
    photo: "/houses/cat-house.jpg",
  },
  {
    id: "lawn",
    label: "Lawn/Grounds",
    blurb: "Lot, mow, irrigation, and beds.",
    photo: "/houses/cat-house.jpg",
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
  plumbing: "/houses/cat-systems.jpg",
  hvac: "/houses/cat-systems.jpg",
  pool: "/houses/cat-house.jpg",
  lawn: "/houses/cat-house.jpg",
  drainage: "/houses/cat-gutters.jpg",
};

/** Homeowner “The house” quote helpers — shown first, and this helps quote. */
export const HOUSE_QUOTE_KEYS = ["stories", "year_built", "lot_size", "square_feet"] as const;

export const HOUSE_ROOMS_JSON_KEY = "house_rooms";

export const HOUSE_ROOM_COUNT_FIELDS = [
  { key: "room_count", label: "Rooms (Value changes below)", placeholder: "6" },
  { key: "toilets", label: "Toilets", placeholder: "2" },
  { key: "sinks", label: "Sinks", placeholder: "3" },
  { key: "closets", label: "Closets", placeholder: "4" },
  { key: "foyer", label: "Foyer", placeholder: "1" },
  { key: "mud_room", label: "Mud room", placeholder: "1" },
  { key: "basement", label: "Basement", placeholder: "1" },
  { key: "attic", label: "Attic", placeholder: "1" },
  { key: "interior_doors", label: "Interior doors", placeholder: "8" },
  { key: "exterior_doors", label: "Exterior doors", placeholder: "2" },
] as const;

export const HOUSE_YESNO_FIELDS = [{ key: "addition", label: "Addition" }] as const;

export const HOUSE_BASEMENT_DETAIL_FIELDS = [
  { key: "basement_finished", label: "Finished", placeholder: "1" },
  { key: "basement_unfinished", label: "Unfinished", placeholder: "1" },
  { key: "basement_stairs", label: "Stairs", placeholder: "1" },
  { key: "basement_doors", label: "Basement doors", placeholder: "1" },
] as const;

export const HOUSE_DRAINAGE_OPTIONS = [
  { value: "exterior", label: "Exterior" },
  { value: "underground", label: "Underground" },
  { value: "above_ground", label: "Above ground" },
  { value: "mix", label: "Mix" },
] as const;

export const HOUSE_ROOM_SHARED_FIELDS = [
  { key: "ceiling_height", label: "Ceiling height", placeholder: "9 ft" },
  { key: "interior_trim_paint", label: "Interior trim", placeholder: "SW Extra White, satin" },
] as const;

export const HOUSE_ROOM_EDITOR_KEYS = [
  ...HOUSE_ROOM_COUNT_FIELDS.map((f) => f.key),
  ...HOUSE_YESNO_FIELDS.map((f) => f.key),
  ...HOUSE_BASEMENT_DETAIL_FIELDS.map((f) => f.key),
  ...HOUSE_ROOM_SHARED_FIELDS.map((f) => f.key),
  "drainage",
  "interior_paint_main",
  HOUSE_ROOMS_JSON_KEY,
] as const;

export const HOUSE_APPLIANCES_JSON_KEY = "house_appliances";
export const WASHER_DRYER_SETS_KEY = "washer_dryer_sets";
export const WASHER_DRYER_LOCATION_KEY = "washer_dryer_location";

export const HOUSE_APPLIANCE_COUNT_FIELDS = [
  { key: "dishwasher_count", label: "Dishwasher", placeholder: "1", kind: "dishwasher" as const },
  { key: "refrigerator_count", label: "Refrigerator", placeholder: "1", kind: "refrigerator" as const },
  { key: "oven_count", label: "Oven", placeholder: "1", kind: "oven" as const },
  { key: "ice_maker_count", label: "Ice maker", placeholder: "1", kind: "ice_maker" as const },
] as const;

export const HOUSE_APPLIANCE_EDITOR_KEYS = [
  WASHER_DRYER_SETS_KEY,
  WASHER_DRYER_LOCATION_KEY,
  ...HOUSE_APPLIANCE_COUNT_FIELDS.map((f) => f.key),
  HOUSE_APPLIANCES_JSON_KEY,
] as const;

export type HouseApplianceKind =
  | "washer_dryer"
  | "dishwasher"
  | "refrigerator"
  | "oven"
  | "ice_maker";

export type HouseAppliance = {
  id: string;
  kind: HouseApplianceKind;
  name: string;
  location: string;
  make: string;
  model: string;
  photo: string;
  washerMake: string;
  washerModel: string;
  dryerMake: string;
  dryerModel: string;
};

export type HouseAppliancesPayload = { items: HouseAppliance[] };

export function emptyHouseAppliance(
  kind: HouseApplianceKind,
  name: string,
  id: string,
  location = "",
): HouseAppliance {
  return {
    id,
    kind,
    name,
    location,
    make: "",
    model: "",
    photo: "",
    washerMake: "",
    washerModel: "",
    dryerMake: "",
    dryerModel: "",
  };
}

export function parseHouseAppliances(raw: string | undefined | null): HouseAppliance[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as HouseAppliancesPayload | HouseAppliance[];
    const items = Array.isArray(parsed) ? parsed : parsed.items;
    if (!Array.isArray(items)) return [];
    return items
      .filter((row) => row && typeof row === "object")
      .map((row, i) => ({
        id: String(row.id || `appliance-${i + 1}`),
        kind: (row.kind as HouseApplianceKind) || "dishwasher",
        name: String(row.name || `Appliance ${i + 1}`),
        location: String(row.location || ""),
        make: String(row.make || ""),
        model: String(row.model || ""),
        photo: String(row.photo || ""),
        washerMake: String(row.washerMake || ""),
        washerModel: String(row.washerModel || ""),
        dryerMake: String(row.dryerMake || ""),
        dryerModel: String(row.dryerModel || ""),
      }));
  } catch {
    return [];
  }
}

function applianceCount(value: string | undefined, max = 4) {
  const n = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, n);
}

export function appliancesFromCounts(input: {
  washerDryerSets: string | undefined;
  dishwasher: string | undefined;
  refrigerator: string | undefined;
  oven: string | undefined;
  iceMaker: string | undefined;
  location: string | undefined;
  existing: HouseAppliance[];
}): HouseAppliance[] {
  const byKind = new Map<HouseApplianceKind, HouseAppliance[]>();
  for (const row of input.existing) {
    const list = byKind.get(row.kind) ?? [];
    list.push(row);
    byKind.set(row.kind, list);
  }
  const loc = (input.location ?? "").trim();
  const take = (
    kind: HouseApplianceKind,
    count: number,
    nameFor: (i: number) => string,
    withLocation = false,
  ) => {
    const prior = byKind.get(kind) ?? [];
    return Array.from({ length: count }, (_, i) => {
      const prev = prior[i];
      const name = nameFor(i);
      if (prev) {
        return {
          ...prev,
          name: prev.name.trim() || name,
          location: prev.location.trim() || (withLocation ? loc : prev.location),
        };
      }
      return emptyHouseAppliance(kind, name, `${kind}-${i + 1}`, withLocation ? loc : "");
    });
  };
  const sets = applianceCount(input.washerDryerSets, 2);
  return [
    ...take(
      "washer_dryer",
      sets,
      (i) => (i === 0 ? "Washer and dryer" : `Washer and dryer ${i + 1}`),
      true,
    ),
    ...take("dishwasher", applianceCount(input.dishwasher), (i) =>
      i === 0 ? "Dishwasher" : `Dishwasher ${i + 1}`,
    ),
    ...take("refrigerator", applianceCount(input.refrigerator), (i) =>
      i === 0 ? "Refrigerator" : `Refrigerator ${i + 1}`,
    ),
    ...take("oven", applianceCount(input.oven), (i) => (i === 0 ? "Oven" : `Oven ${i + 1}`)),
    ...take("ice_maker", applianceCount(input.iceMaker), (i) =>
      i === 0 ? "Ice maker" : `Ice maker ${i + 1}`,
    ),
  ];
}

export type HouseRoomKind = "room" | "foyer" | "mud_room" | "basement" | "attic" | "addition";

export type HouseRoomFloor = {
  id: string;
  kind: HouseRoomKind;
  name: string;
  flooring: string;
  stain: string;
  paint: string;
  photo: string;
};

export type HouseRoomsPayload = { items: HouseRoomFloor[] };

export function emptyHouseRoom(kind: HouseRoomKind, name: string, id: string): HouseRoomFloor {
  return { id, kind, name, flooring: "", stain: "", paint: "", photo: "" };
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
        paint: String(row.paint || ""),
        photo: String(row.photo || ""),
      }));
  } catch {
    return [];
  }
}

function countFromFact(value: string | undefined, fallback = 0) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "yes") return 1;
  if (raw === "no") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(20, n);
}

export function roomsFromCounts(input: {
  rooms: string | undefined;
  foyer: string | undefined;
  mudRoom: string | undefined;
  basement: string | undefined;
  attic: string | undefined;
  addition: string | undefined;
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
    ...take("basement", countFromFact(input.basement), (i) => (i === 0 ? "Basement" : `Basement ${i + 1}`)),
    ...take("attic", countFromFact(input.attic), (i) => (i === 0 ? "Attic" : `Attic ${i + 1}`)),
    ...take("addition", input.addition === "yes" ? 1 : 0, () => "Addition"),
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
    key: "interior_doors",
    label: "Interior doors",
    group: "house",
    hint: "Count of interior doors. This helps quote paint, trim, and hardware.",
    placeholder: "8",
  },
  {
    key: "exterior_doors",
    label: "Exterior doors",
    group: "house",
    hint: "Count of exterior doors, including the front door.",
    placeholder: "2",
  },
  {
    key: "basement",
    label: "Basement",
    group: "house",
    hint: "How many basements. Finished, unfinished, stairs, and doors come next.",
    placeholder: "1",
  },
  {
    key: "attic",
    label: "Attic",
    group: "house",
    hint: "How many attics. Leave blank if none.",
    placeholder: "1",
  },
  {
    key: "addition",
    label: "Addition",
    group: "house",
    hint: "Check if the house has an addition. This adds a room card below.",
    placeholder: "yes",
  },
  {
    key: "basement_finished",
    label: "Finished",
    group: "house",
    hint: "How much of the basement is finished.",
    placeholder: "1",
  },
  {
    key: "basement_unfinished",
    label: "Unfinished",
    group: "house",
    hint: "How much of the basement is unfinished.",
    placeholder: "1",
  },
  {
    key: "basement_stairs",
    label: "Stairs",
    group: "house",
    hint: "Basement stair runs.",
    placeholder: "1",
  },
  {
    key: "basement_doors",
    label: "Basement doors",
    group: "house",
    hint: "Walk-out, bulkhead, or interior basement doors.",
    placeholder: "1",
  },
  {
    key: "drainage",
    label: "Drainage",
    group: "house",
    hint: "Exterior, underground, above ground, or mix.",
    placeholder: "underground",
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
    key: "ceiling_height",
    label: "Ceiling height",
    group: "house",
    hint: "Changes scaffold and paint yield. Lives with the rooms.",
    placeholder: "9 ft",
  },
  {
    key: "interior_paint_main",
    label: "Wall color",
    group: "house",
    hint: "House-wide wall color. Each room can set its own paint color.",
    placeholder: "SW 7029 Agreeable Gray",
  },
  {
    key: "interior_trim_paint",
    label: "Interior trim",
    group: "house",
    hint: "Enamel formula and sheen. Lives with the rooms.",
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
  {
    key: "washer_dryer_sets",
    label: "Washer and dryer",
    group: "systems",
    hint: "1 or 2 sets. This helps quote laundry hookups and haul-away.",
    placeholder: "1",
  },
  {
    key: "washer_dryer_location",
    label: "Washer and dryer location",
    group: "systems",
    hint: "Laundry room, basement, garage, or mud room.",
    placeholder: "Laundry room",
  },
  {
    key: "dishwasher_count",
    label: "Dishwasher",
    group: "systems",
    hint: "How many dishwashers stay with the house.",
    placeholder: "1",
  },
  {
    key: "refrigerator_count",
    label: "Refrigerator",
    group: "systems",
    hint: "How many refrigerators stay with the house.",
    placeholder: "1",
  },
  {
    key: "oven_count",
    label: "Oven",
    group: "systems",
    hint: "Wall oven, range, or both.",
    placeholder: "1",
  },
  {
    key: "ice_maker_count",
    label: "Ice maker",
    group: "systems",
    hint: "Stand-alone or in the freezer. Leave blank if none.",
    placeholder: "1",
  },
  {
    key: "house_appliances",
    label: "Appliance make and model",
    group: "systems",
    hint: "Make, model, and a photo for each appliance.",
    placeholder: "",
  },
  {
    key: "plumbing_scope",
    label: "Plumbing work",
    group: "plumbing",
    hint: "Repair, fixture, drain, or water heater.",
    placeholder: "repair",
  },
  {
    key: "fixture_count",
    label: "Fixtures",
    group: "plumbing",
    hint: "Toilets, sinks, or valves on this house.",
    placeholder: "1",
  },
  {
    key: "plumbing_note",
    label: "Plumbing notes",
    group: "plumbing",
    hint: "The leak, clog, or fixture that needs work.",
    placeholder: "Kitchen sink slow drain",
  },
  {
    key: "pool_type",
    label: "Pool type",
    group: "pool",
    hint: "In-ground, above-ground, or spa.",
    placeholder: "inground",
  },
  {
    key: "pool_year",
    label: "Pool year",
    group: "pool",
    hint: "Age of the shell and equipment.",
    placeholder: "2014",
  },
  {
    key: "pool_equipment",
    label: "Pool equipment",
    group: "pool",
    hint: "Pump, filter, heater, and salt system.",
    placeholder: "Pentair pump and cartridge filter",
  },
  {
    key: "pool_scope",
    label: "Pool work",
    group: "pool",
    hint: "Weekly, open, close, or repair.",
    placeholder: "weekly",
  },
  {
    key: "mow_frequency",
    label: "Mow frequency",
    group: "lawn",
    hint: "How often the lawn is cut.",
    placeholder: "weekly",
  },
  {
    key: "irrigation",
    label: "Irrigation",
    group: "lawn",
    hint: "Zones, clock, and what is failing.",
    placeholder: "6 zones, Hunter clock",
  },
  {
    key: "lawn_notes",
    label: "Grounds notes",
    group: "lawn",
    hint: "Beds, trees, and what the next visit should know.",
    placeholder: "Front beds need mulch",
  },
  {
    key: "lawn_scope",
    label: "Lawn work",
    group: "lawn",
    hint: "Mow, seasonal, irrigation, or beds.",
    placeholder: "mow",
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

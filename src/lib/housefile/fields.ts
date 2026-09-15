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

export const FIELD_GROUPS: { id: FieldGroup; label: string; blurb: string }[] = [
  {
    id: "house",
    label: "The house",
    blurb: "Size, stories, and site rules every quote uses.",
  },
  {
    id: "paint",
    label: "Paint",
    blurb: "Interior rooms and exterior colors that stay with the house.",
  },
  {
    id: "roof",
    label: "Roof",
    blurb: "Squares, pitch, layers, and what is on it now.",
  },
  {
    id: "windows",
    label: "Windows",
    blurb: "Count, type, year, and the product that was installed.",
  },
  {
    id: "gutters",
    label: "Gutters",
    blurb: "Eave run, downspouts, size, and material.",
  },
  {
    id: "siding",
    label: "Siding",
    blurb: "What is on the elevations and what went on last.",
  },
  {
    id: "decks",
    label: "Decks",
    blurb: "Walking surface and the stain that has to match.",
  },
  {
    id: "porches",
    label: "Porches",
    blurb: "Floor area and whether it is open, covered, or screened.",
  },
  {
    id: "systems",
    label: "Systems",
    blurb: "HVAC, water heater, electrical, and attic — not a takeoff, but the next shop asks.",
  },
];

export const FIELD_CATALOG: FieldDef[] = [
  {
    key: "year_built",
    label: "Year built",
    group: "house",
    hint: "Ages labor and material estimates.",
    placeholder: "1924",
  },
  {
    key: "square_feet",
    label: "Finished square feet",
    group: "house",
    hint: "Drives paint, flooring, roof footprint, and HVAC sizing.",
    placeholder: "1840",
  },
  {
    key: "stories",
    label: "Stories",
    group: "house",
    hint: "Affects access, staging, and fall protection.",
    placeholder: "1.5",
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
    key: "lot_size",
    label: "Lot size",
    group: "house",
    hint: "Access, dumpsters, and landscaping.",
    placeholder: "0.28 acre",
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
    hint: "Species, finish, or product.",
    placeholder: "White oak, site-finished",
  },

  {
    key: "room_count",
    label: "Rooms",
    group: "paint",
    hint: "How many rooms the last interior takeoff used.",
    placeholder: "6",
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
  { id: "product", label: "Product / color" },
  { id: "damage", label: "Damage" },
  { id: "general", label: "General" },
] as const;

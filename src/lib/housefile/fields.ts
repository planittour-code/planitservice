export type FieldGroup = "structure" | "roof" | "systems" | "interior" | "site";

export type FieldDef = {
  key: string;
  label: string;
  group: FieldGroup;
  hint: string;
  placeholder: string;
};

export const FIELD_GROUPS: { id: FieldGroup; label: string }[] = [
  { id: "structure", label: "Structure" },
  { id: "roof", label: "Roof & exterior" },
  { id: "systems", label: "Systems" },
  { id: "interior", label: "Interior" },
  { id: "site", label: "Site & rules" },
];

export const FIELD_CATALOG: FieldDef[] = [
  { key: "year_built", label: "Year built", group: "structure", hint: "Ages labor and material estimates.", placeholder: "1924" },
  { key: "square_feet", label: "Finished square feet", group: "structure", hint: "Drives paint, flooring, and HVAC sizing.", placeholder: "1840" },
  { key: "stories", label: "Stories", group: "structure", hint: "Affects access, staging, and fall protection.", placeholder: "1.5" },
  { key: "foundation_type", label: "Foundation", group: "structure", hint: "Crawlspace vs slab changes plumbing and HVAC.", placeholder: "Brick pier crawlspace" },
  { key: "occupancy", label: "Occupancy", group: "structure", hint: "Lived-in homes need dust control and timing.", placeholder: "Primary residence" },

  { key: "roof_type", label: "Roof type", group: "roof", hint: "Shingle, metal, slate — the starting assembly.", placeholder: "Architectural shingle" },
  { key: "roof_year", label: "Roof year", group: "roof", hint: "Age is the first question on a reroof quote.", placeholder: "2019" },
  { key: "siding_type", label: "Siding", group: "roof", hint: "Clapboard, brick, fiber-cement change prep.", placeholder: "Wood clapboard" },
  { key: "exterior_paint", label: "Body paint", group: "roof", hint: "Color and product, so the next coat matches.", placeholder: "SW 7008 Alabaster" },
  { key: "exterior_trim_paint", label: "Trim paint", group: "roof", hint: "Keep the trim formula with the house.", placeholder: "SW Extra White" },
  { key: "front_door_paint", label: "Front door paint", group: "roof", hint: "Accent colors are easy to lose.", placeholder: "SW 2801 Rookwood Red" },
  { key: "gutter_type", label: "Gutters", group: "roof", hint: "Size, material, and guards.", placeholder: "6-inch aluminum with guards" },
  { key: "window_type", label: "Windows", group: "roof", hint: "Wood vs vinyl changes painting and replacement.", placeholder: "Wood divided-lite" },
  { key: "window_year", label: "Window year", group: "roof", hint: "Helps quote replacement vs restore.", placeholder: "1998" },
  { key: "window_count", label: "Window count", group: "roof", hint: "Openings on the last window quote.", placeholder: "12" },
  { key: "window_product", label: "Window product", group: "roof", hint: "What was installed, with the warranty.", placeholder: "Andersen 100 Series" },
  { key: "siding_new", label: "Siding product", group: "roof", hint: "What went on last, so the next elevation matches.", placeholder: "James Hardie fiber-cement" },
  { key: "roof_squares", label: "Roof squares", group: "roof", hint: "100 sq ft per square, including waste.", placeholder: "24" },
  { key: "roof_pitch", label: "Roof pitch", group: "roof", hint: "Access and waste factor.", placeholder: "6/12" },
  { key: "roof_layers", label: "Roof layers", group: "roof", hint: "How many layers came off last time.", placeholder: "1" },
  { key: "gutter_lf", label: "Gutter run", group: "roof", hint: "Linear feet of eave.", placeholder: "140" },
  { key: "downspout_count", label: "Downspouts", group: "roof", hint: "Leaders to grade.", placeholder: "4" },

  { key: "hvac_type", label: "HVAC type", group: "systems", hint: "Split, heat pump, or boiler.", placeholder: "Gas furnace + A/C" },
  { key: "hvac_year", label: "HVAC year", group: "systems", hint: "Age is the quote.", placeholder: "2016" },
  { key: "hvac_brand", label: "HVAC brand", group: "systems", hint: "Parts and warranty lookup.", placeholder: "Carrier" },
  { key: "water_heater_type", label: "Water heater", group: "systems", hint: "Tank, tankless, or hybrid.", placeholder: "50-gal gas tank" },
  { key: "water_heater_year", label: "Water heater year", group: "systems", hint: "Most last 8–12 years.", placeholder: "2018" },
  { key: "electrical_panel", label: "Electrical panel", group: "systems", hint: "Brand and condition matter for permits.", placeholder: "Square D" },
  { key: "electrical_amps", label: "Service amps", group: "systems", hint: "Needed for HVAC and EV quotes.", placeholder: "200" },
  { key: "attic_insulation", label: "Attic insulation", group: "systems", hint: "R-value and type.", placeholder: "R-30 cellulose" },

  { key: "interior_paint_main", label: "Main interior paint", group: "interior", hint: "The house color, written down.", placeholder: "SW 7029 Agreeable Gray" },
  { key: "interior_trim_paint", label: "Interior trim", group: "interior", hint: "Enamel formula and sheen.", placeholder: "SW Extra White, satin" },
  { key: "flooring_main", label: "Main flooring", group: "interior", hint: "Species, finish, or product.", placeholder: "White oak, site-finished" },
  { key: "ceiling_height", label: "Ceiling height", group: "interior", hint: "Changes scaffold and paint yield.", placeholder: "9 ft" },
  { key: "room_count", label: "Rooms", group: "interior", hint: "How many rooms the last interior takeoff used.", placeholder: "6" },

  { key: "hvac_tons", label: "HVAC tons", group: "systems", hint: "Sized from the last load calc.", placeholder: "2.5" },

  { key: "lot_size", label: "Lot size", group: "site", hint: "Access, dumpsters, and landscaping.", placeholder: "0.28 acre" },
  { key: "driveway_type", label: "Driveway", group: "site", hint: "Protect or replace.", placeholder: "Concrete" },
  { key: "fence", label: "Fence", group: "site", hint: "Material and height.", placeholder: "Cedar privacy, 6 ft" },
  { key: "hoa_name", label: "HOA", group: "site", hint: "Color and material rules live here.", placeholder: "Maple Park Civic" },
  { key: "hoa_rules", label: "HOA notes", group: "site", hint: "Approved colors, notice windows.", placeholder: "Earth tones only; 14-day notice" },
  { key: "deck_sf", label: "Deck square feet", group: "site", hint: "Walking surface for stain and boards.", placeholder: "320" },
  { key: "stain_color", label: "Deck stain", group: "site", hint: "The next coat has to match.", placeholder: "Dark Walnut" },
  { key: "porch_sf", label: "Porch square feet", group: "site", hint: "Floor of the porch.", placeholder: "180" },
  { key: "porch_type", label: "Porch type", group: "site", hint: "Open, covered, or screened.", placeholder: "covered" },
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

import { CATEGORY_PHOTO } from "./fields";

export type MeasureStep = {
  title: string;
  body: string;
};

export type MeasureGuide = {
  id: string;
  name: string;
  photo: string;
  chip: string;
  what: string;
  tools: string;
  steps: MeasureStep[];
  tip: string;
};

export const MEASURE_GUIDES: MeasureGuide[] = [
  {
    id: "paint",
    name: "Paint",
    photo: CATEGORY_PHOTO.paint,
    chip: "Floor sf + rooms",
    what: "Shops price paint from floor square feet, room count, ceiling height, and stories — not from a guess at wall area.",
    tools: "Tape measure, notepad, and a photo of each room or elevation.",
    steps: [
      {
        title: "Interior — floor area",
        body: "Measure length × width of each room you want painted. Add the rooms together. Closets count if they get painted. Skip halls only if you are not painting them.",
      },
      {
        title: "Interior — rooms and height",
        body: "Count the rooms (not the walls). Measure floor to ceiling in one typical room. Note 8 ft vs 9–10 ft — taller walls change gallons and time.",
      },
      {
        title: "Exterior — the house, not the lot",
        body: "Use finished square feet and stories from the record if you have them. Walk the elevations and photo each side. Note siding type and whether trim, soffit, and the front door are in the job.",
      },
    ],
    tip: "Write the color and product you want on the record. A shop can still take a final wall measure on site.",
  },
  {
    id: "roof",
    name: "Roof",
    photo: CATEGORY_PHOTO.roof,
    chip: "Squares or footprint",
    what: "A square is 100 square feet of roof. If you do not know squares, shops estimate from the house footprint and pitch.",
    tools: "House footprint (or finished square feet), a ground photo of each slope, and the year it was last done.",
    steps: [
      {
        title: "Do not walk the roof",
        body: "Stay on the ground. Photo every slope, the valleys, and the chimney. Note if two layers of shingle are already on — look at a gable end or a vent boot.",
      },
      {
        title: "Footprint if squares are unknown",
        body: "Length × width of the house, then stories. A simple gable is close to footprint × pitch factor; a shop will still drone or walk it before they order.",
      },
      {
        title: "Pitch from the ground",
        body: "Stand at the gable: low (walkable), average, or steep (you would not walk it). That is enough for a first number.",
      },
    ],
    tip: "Age and layer count change the tear-off more than a missing square count. Put the roof year on the record.",
  },
  {
    id: "windows",
    name: "Windows",
    photo: CATEGORY_PHOTO.windows,
    chip: "Openings, not glass",
    what: "Shops price windows by opening count and access — each unit, not the glass size you guess from inside.",
    tools: "A walk of the house, a count on paper, photos of typical units.",
    steps: [
      {
        title: "Count openings",
        body: "Walk outside. Count every window in this job, including small baths and transoms if they are in scope. A bay is more than one opening.",
      },
      {
        title: "Note the type",
        body: "Wood, vinyl, aluminum, or fiberglass. Same house often mixed — photo the odd ones.",
      },
      {
        title: "Stories and screens",
        body: "Second-story units need staging. Say whether new screens and interior casing are in the ask.",
      },
    ],
    tip: "You do not need exact rough openings. Count and photos get a number; the shop measures each unit before order.",
  },
  {
    id: "gutters",
    name: "Gutters",
    photo: CATEGORY_PHOTO.gutters,
    chip: "Eave run in feet",
    what: "Gutters are linear feet of eave, plus downspout count. Corners are in the unit price — do not add them twice.",
    tools: "A 25–100 ft tape, or pace the eaves knowing your stride.",
    steps: [
      {
        title: "Measure the eaves",
        body: "Walk the drip edge on the ground. Measure each eave run and add them. Skip rakes (the sloped gable edges) — gutters do not hang there.",
      },
      {
        title: "Downspouts",
        body: "Count existing leaders, or mark where new ones should land. Typical house is 3–6.",
      },
      {
        title: "Stories and guards",
        body: "One-story vs two-story changes hang time. Say if Roll Lock Gutter Guards are in the job.",
      },
    ],
    tip: "A long tape along the foundation under each eave is close enough for an estimate. The shop will still check corners on site.",
  },
  {
    id: "drainage",
    name: "Drainage",
    photo: CATEGORY_PHOTO.drainage,
    chip: "Leaders and pipe",
    what: "Drainage is the run that takes water off the downspouts and away from the foundation — buried pipe, above-grade extensions, or both.",
    tools: "Tape along the path the water should take. One photo at each downspout, one where it should daylight.",
    steps: [
      {
        title: "Downspouts",
        body: "Count the leaders this job catches. Note which ones pond against the house.",
      },
      {
        title: "The run",
        body: "Measure from each outlet to where the water should leave — yard, street, or an existing drain. Add the runs.",
      },
      {
        title: "Above or below grade",
        body: "Say underground, above ground, exterior grade, or a mix. A pop-up in the yard is still an underground run.",
      },
    ],
    tip: "A photo of standing water after rain, plus the path you want it to take, is enough for a first number.",
  },
  {
    id: "siding",
    name: "Siding",
    photo: CATEGORY_PHOTO.siding,
    chip: "House size + stories",
    what: "Elevation area is estimated from finished square feet and stories. You do not need to measure every wall.",
    tools: "Finished square feet from the record or tax card, photos of each elevation.",
    steps: [
      {
        title: "Size and stories",
        body: "Put finished square feet and stories on the record. That is the takeoff start.",
      },
      {
        title: "What is on it now",
        body: "Walk each side. Note wood, vinyl, fiber-cement, or mixed. Photo damage, and whether windows and trim stay.",
      },
      {
        title: "Openings",
        body: "You do not subtract every window. A shop does that. Flag large blank walls vs walls full of openings.",
      },
    ],
    tip: "Product name (Hardie, vinyl, wood) belongs on the record with the body color. That is what the next coat has to match.",
  },
  {
    id: "deck",
    name: "Decks and porches",
    photo: CATEGORY_PHOTO.deck,
    chip: "Walking surface",
    what: "Deck work is the walking surface in square feet — length × width of the boards you stand on, not the lot.",
    tools: "Tape measure. Measure the boards, not the rail.",
    steps: [
      {
        title: "Walking surface",
        body: "Length × width of the deck floor. L-shapes: measure each rectangle and add. Do not include stairs as floor unless you want them in the job.",
      },
      {
        title: "Boards to replace",
        body: "Count failed boards, or photo them and say “scattered” vs “a whole run.”",
      },
      {
        title: "Rail and stain",
        body: "Say if the rail is in the job. Write the stain color you want to match.",
      },
    ],
    tip: "A photo looking down the boards plus one of the rail is enough for a first number.",
  },
  {
    id: "porch",
    name: "Porches",
    photo: CATEGORY_PHOTO.porch,
    chip: "Floor of this porch",
    what: "Price the porch, not the house. Floor square feet and whether it is open, covered, or screened.",
    tools: "Tape on the porch floor. One photo in, one photo out.",
    steps: [
      {
        title: "Floor area",
        body: "Length × width of this porch floor. If there are two porches, measure each.",
      },
      {
        title: "Type",
        body: "Open (floor and rail), covered (ceiling too), or screened. That changes the assembly.",
      },
      {
        title: "Rail and finish",
        body: "Note if the rail, ceiling, or screens are in the ask. Write the floor finish.",
      },
    ],
    tip: "A second-story porch is a different staging job — put stories on the record.",
  },
  {
    id: "flooring",
    name: "Flooring",
    photo: CATEGORY_PHOTO.house,
    chip: "Floor of each room",
    what: "Flooring shops price from room floor area, room count, and the product and color on the record.",
    tools: "Tape measure, a photo of the existing floor in each room, and the color or stain you want.",
    steps: [
      {
        title: "Floor area",
        body: "Length × width of each room in this job. Add the rooms. Closets and halls count if they get the same product.",
      },
      {
        title: "What is on it now",
        body: "Note hardwood, berber, vinyl, or tile. Photo the color. A stain or berber swatch belongs on the room card.",
      },
      {
        title: "What goes down",
        body: "Write the new product and color or stain. Say if baseboards are in the job.",
      },
    ],
    tip: "Room photos of the existing floor are enough for a first number. The shop still measures each room before order.",
  },
];

export function measureGuideFor(workId: string) {
  const id = workId === "porch" ? "deck" : workId;
  return MEASURE_GUIDES.find((g) => g.id === id) ?? MEASURE_GUIDES[0]!;
}

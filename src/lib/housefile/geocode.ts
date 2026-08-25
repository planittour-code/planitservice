export type AddressHit = {
  line: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
};

const STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN",
  texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
};

export function formatLine(address: string, city: string, state: string, zip: string) {
  const tail = [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return tail ? `${address}, ${tail}` : address;
}

export function parseStreet(raw: string): AddressHit {
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const tail = parts[2]!.split(/\s+/);
    return {
      line: formatLine(parts[0]!, parts[1]!, tail[0] ?? "", tail[1] ?? ""),
      address: parts[0]!,
      city: parts[1]!,
      state: stateAbbr(tail[0] ?? ""),
      zip: (tail[1] ?? "").slice(0, 5),
    };
  }
  if (parts.length === 2) {
    const tail = parts[1]!.split(/\s+/);
    const maybeState = stateAbbr(tail[0] ?? "");
    if (maybeState.length === 2 && maybeState === maybeState.toUpperCase()) {
      return {
        line: formatLine(parts[0]!, "", maybeState, tail[1] ?? ""),
        address: parts[0]!,
        city: "",
        state: maybeState,
        zip: (tail[1] ?? "").slice(0, 5),
      };
    }
    return {
      line: formatLine(parts[0]!, parts[1]!, "", ""),
      address: parts[0]!,
      city: parts[1]!,
      state: "",
      zip: "",
    };
  }
  return { line: raw.trim(), address: raw.trim(), city: "", state: "", zip: "" };
}

export function stateAbbr(value: string) {
  const t = value.trim();
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  return STATES[t.toLowerCase()] ?? t;
}

export function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Ne|Nw|Se|Sw)\b/g, (m) => m.toUpperCase());
}

type PhotonProps = {
  countrycode?: string;
  housenumber?: string;
  street?: string;
  name?: string;
  city?: string;
  locality?: string;
  state?: string;
  postcode?: string;
};

export async function suggestFromPhoton(query: string): Promise<AddressHit[]> {
  const q = query.trim().slice(0, 80);
  if (q.length < 4) return [];
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=en`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "PlanitService/1.0" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return [];
  const body = (await res.json()) as {
    features?: { properties?: PhotonProps; geometry?: { coordinates?: number[] } }[];
  };
  const seen = new Set<string>();
  const hits: AddressHit[] = [];
  for (const feature of body.features ?? []) {
    const hit = fromPhoton(feature.properties ?? {});
    if (!hit || seen.has(hit.line)) continue;
    const coords = feature.geometry?.coordinates;
    if (coords && coords.length >= 2) {
      hit.lng = coords[0];
      hit.lat = coords[1];
    }
    seen.add(hit.line);
    hits.push(hit);
    if (hits.length >= 6) break;
  }
  return hits;
}

function fromPhoton(p: PhotonProps): AddressHit | null {
  if (p.countrycode && p.countrycode.toUpperCase() !== "US") return null;
  const street = p.street || p.name;
  if (!street) return null;
  const address = titleCase([p.housenumber, street].filter(Boolean).join(" "));
  const city = titleCase(p.city || p.locality || "");
  const state = stateAbbr(p.state || "");
  const zip = (p.postcode || "").slice(0, 5);
  if (!city && !state) return null;
  return { line: formatLine(address, city, state, zip), address, city, state, zip };
}

type CensusMatch = {
  matchedAddress?: string;
  coordinates?: { x: number; y: number };
  addressComponents?: {
    fromAddress?: string;
    preDirection?: string;
    streetName?: string;
    suffixType?: string;
    suffixDirection?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
};

export function houseNumber(line: string) {
  const m = line.trim().match(/^(\d+[A-Za-z]?)\b/);
  return m?.[1] ?? "";
}

export async function standardizeFromCensus(query: string): Promise<AddressHit> {
  const fallback = parseStreet(query);
  const q = query.trim().slice(0, 80);
  if (q.length < 5) return fallback;
  const url =
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress" +
    `?address=${encodeURIComponent(q)}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "PlanitService/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return fallback;
    const body = (await res.json()) as { result?: { addressMatches?: CensusMatch[] } };
    const match = body.result?.addressMatches?.[0];
    const c = match?.addressComponents;
    if (!c) return fallback;
    const censusStreet = titleCase(
      [c.fromAddress, c.preDirection, c.streetName, c.suffixType, c.suffixDirection]
        .filter(Boolean)
        .join(" "),
    );
    const city = titleCase(c.city || fallback.city);
    const state = stateAbbr(c.state || fallback.state);
    const zip = (c.zip || fallback.zip).slice(0, 5);
    const wanted = houseNumber(fallback.address);
    const got = houseNumber(censusStreet);
    const sameHouse = !wanted || !got || wanted === got;
    const address = sameHouse ? censusStreet || titleCase(fallback.address) : titleCase(fallback.address);
    if (!address) return fallback;
    const hit: AddressHit = {
      line: formatLine(address, city, state, zip),
      address,
      city,
      state,
      zip,
    };
    if (sameHouse && match.coordinates) {
      hit.lat = match.coordinates.y;
      hit.lng = match.coordinates.x;
    }
    return hit;
  } catch {
    return fallback;
  }
}

export function aerialUrl(lat: number, lng: number) {
  const pad = 0.0007;
  const bbox = `${lng - pad},${lat - pad},${lng + pad},${lat + pad}`;
  return (
    "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export" +
    `?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=1280,720&format=jpg&f=image`
  );
}

export function streetViewEmbed(lat: number, lng: number) {
  return `https://maps.google.com/maps?q=${lat},${lng}&layer=c&cbll=${lat},${lng}&output=svembed`;
}

export function streetViewLink(lat: number, lng: number) {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
}

export function zillowLink(address: string, city: string, state: string, zip: string) {
  const slug = [address, city, state, zip]
    .filter(Boolean)
    .join(" ")
    .replace(/[^\w]+/g, "-")
    .replace(/^-|-$/g, "");
  return `https://www.zillow.com/homes/${slug}_rb/`;
}


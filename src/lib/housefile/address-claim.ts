import type { Sql } from "@/lib/db";

/** Shown when someone types a street that already belongs to another household. */
export const CLAIMED_ADDRESS_MESSAGE =
  "This address has been claimed. Double-check the address.";

/** Extra note under the wall. No owner names or emails. */
export const CLAIMED_ADDRESS_NOTE =
  "Each Property Record belongs to one household. Confirm this is your street. If it is already on file, ask the owner or the shop for the invite instead of opening a second record.";

export function normalizeStreetKey(line: string) {
  return line
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\b(northwest|northeast|southwest|southeast)\b/g, (m) =>
      m === "northwest" ? "nw" : m === "northeast" ? "ne" : m === "southwest" ? "sw" : "se",
    )
    .replace(/\b(street|st)\b/g, "st")
    .replace(/\b(road|rd)\b/g, "rd")
    .replace(/\b(drive|dr)\b/g, "dr")
    .replace(/\b(court|ct)\b/g, "ct")
    .replace(/\b(avenue|ave)\b/g, "ave")
    .replace(/\b(lane|ln)\b/g, "ln")
    .replace(/\b(boulevard|blvd)\b/g, "blvd")
    .replace(/\s+/g, " ")
    .trim();
}

export function zipKey(zip: string) {
  const z = zip.trim().slice(0, 5);
  if (!z || z === "—" || z === "-") return "";
  return z.toLowerCase();
}

export function addressKey(line: string, zip: string) {
  return `${normalizeStreetKey(line)}|${zipKey(zip)}`;
}

export function sameAddress(
  a: { address_line: string; zip: string },
  b: { address_line: string; zip: string },
) {
  return addressKey(a.address_line, a.zip) === addressKey(b.address_line, b.zip);
}

/** Same street; ZIP must match when both sides have one. */
export function claimedAddressMatch(
  a: { address_line: string; zip: string },
  b: { address_line: string; zip: string },
) {
  if (normalizeStreetKey(a.address_line) !== normalizeStreetKey(b.address_line)) return false;
  const za = zipKey(a.zip);
  const zb = zipKey(b.zip);
  if (!za || !zb) return true;
  return za === zb;
}

export async function findClaimedByOther(
  sql: Sql,
  input: {
    addressLine: string;
    zip?: string;
    userId?: string | null;
    exceptPropertyId?: string | null;
  },
): Promise<{ id: string } | null> {
  const street = input.addressLine.trim();
  if (street.length < 3) return null;
  const zip5 = zipKey(input.zip ?? "");
  const except = input.exceptPropertyId ?? "";
  const userId = input.userId ?? "";
  type ClaimRow = { id: string; address_line: string; zip: string };
  let rows: ClaimRow[] = [];
  if (zip5) {
    rows = await sql<ClaimRow>`
      select id, address_line, zip from properties
      where homeowner_user_id is not null
        and left(trim(zip), 5) = ${zip5}
        and (homeowner_user_id <> ${userId} or ${userId} = ${""})
        and (id <> ${except} or ${except} = ${""})
      limit 200
    `;
  } else {
    const number = street.match(/^\d+[a-z]?/i)?.[0]?.toLowerCase() ?? "";
    const like = number ? `${number} %` : `${street.toLowerCase().slice(0, 24)}%`;
    rows = await sql<ClaimRow>`
      select id, address_line, zip from properties
      where homeowner_user_id is not null
        and lower(address_line) like ${like}
        and (homeowner_user_id <> ${userId} or ${userId} = ${""})
        and (id <> ${except} or ${except} = ${""})
      limit 200
    `;
  }
  const needle = { address_line: street, zip: input.zip ?? "" };
  const hit = rows.find((row) => claimedAddressMatch(row, needle));
  return hit ? { id: hit.id } : null;
}

export function assertAddressAvailable(hit: { id: string } | null) {
  if (hit) throw new Error(CLAIMED_ADDRESS_MESSAGE);
}

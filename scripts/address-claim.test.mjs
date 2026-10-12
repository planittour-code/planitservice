import assert from "node:assert/strict";
import test from "node:test";

function normalizeStreetKey(line) {
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

function zipKey(zip) {
  const z = zip.trim().slice(0, 5);
  if (!z || z === "—" || z === "-") return "";
  return z.toLowerCase();
}

function claimedAddressMatch(a, b) {
  if (normalizeStreetKey(a.address_line) !== normalizeStreetKey(b.address_line)) return false;
  const za = zipKey(a.zip);
  const zb = zipKey(b.zip);
  if (!za || !zb) return true;
  return za === zb;
}

test("court and ct are the same street", () => {
  assert.equal(
    claimedAddressMatch(
      { address_line: "4016 Almond Court", zip: "30067" },
      { address_line: "4016 almond ct", zip: "30067" },
    ),
    true,
  );
});

test("missing zip still matches the same street", () => {
  assert.equal(
    claimedAddressMatch(
      { address_line: "4016 Almond Court", zip: "—" },
      { address_line: "4016 Almond Court", zip: "30067" },
    ),
    true,
  );
});

test("a different house number does not match", () => {
  assert.equal(
    claimedAddressMatch(
      { address_line: "4016 Almond Court", zip: "30067" },
      { address_line: "4018 Almond Court", zip: "30067" },
    ),
    false,
  );
});

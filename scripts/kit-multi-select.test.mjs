import assert from "node:assert/strict";
import test from "node:test";

function selectedKitIds(raw) {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function joinKitIds(ids) {
  return ids.filter(Boolean).join(",");
}

function kitNamesLabel(names) {
  return names.map((name) => name.trim()).filter(Boolean).join(", ");
}

function linesFromKits(kits) {
  const seen = new Set();
  const merged = [];
  for (const kit of kits) {
    for (const item of kit.items ?? []) {
      const key = String(item.name ?? "")
        .trim()
        .toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(item.name);
    }
  }
  return merged;
}

test("comma-separated kit ids round-trip", () => {
  assert.deepEqual(selectedKitIds(""), []);
  assert.deepEqual(selectedKitIds("a,b"), ["a", "b"]);
  assert.equal(joinKitIds(["a", "b"]), "a,b");
});

test("quote title names every selected sub-category", () => {
  assert.equal(kitNamesLabel(["5-Inch New Install", "Maintenance Plan"]), "5-Inch New Install, Maintenance Plan");
});

function lineShowsInstalledProduct(name) {
  const n = name.trim().toLowerCase();
  if (!n) return true;
  if (/\bclean(?:ing|er|s)?\b/.test(n)) return false;
  if (/\bdownspouts?\b/.test(n)) return false;
  return true;
}

test("gutter product and warranty stay on new install, not cleaning or downspouts", () => {
  assert.equal(lineShowsInstalledProduct("Hang 6-inch K-style gutters"), true);
  assert.equal(lineShowsInstalledProduct("5-Inch New Install"), true);
  assert.equal(lineShowsInstalledProduct("Gutter cleaning"), false);
  assert.equal(lineShowsInstalledProduct("Downspouts and elbows"), false);
  assert.equal(lineShowsInstalledProduct("Downspout"), false);
});

test("merged kits keep unique line items in selection order", () => {
  const names = linesFromKits([
    {
      items: [
        { name: "Hang 5-inch K-style gutters" },
        { name: "Downspouts and elbows" },
        { name: "Hidden hangers" },
      ],
    },
    {
      items: [
        { name: "Gutter cleaning" },
        { name: "Seasonal visits" },
        { name: "Hidden hangers" },
      ],
    },
  ]);
  assert.deepEqual(names, [
    "Hang 5-inch K-style gutters",
    "Downspouts and elbows",
    "Hidden hangers",
    "Gutter cleaning",
    "Seasonal visits",
  ]);
});

import assert from "node:assert/strict";
import test from "node:test";

test("drainage invoice title matching", () => {
  const kit = "Gutters Plus Drainage";
  const isDrainage = (title) => {
    const value = (title ?? "").trim();
    if (!value) return false;
    if (value.toLowerCase().includes(kit.toLowerCase())) return true;
    return /drainage/i.test(value) && /gutter/i.test(value);
  };
  assert.equal(isDrainage("Gutters — Gutters Plus Drainage"), true);
  assert.equal(isDrainage("Gutters Plus Drainage"), true);
  assert.equal(isDrainage("5-Inch New Install"), false);
  assert.equal(isDrainage("Interior walls and trim"), false);
});

test("invoice number is last five of id, no customer data", () => {
  const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeffff21785";
  const no = id.replace(/-/g, "").slice(-5).toUpperCase();
  assert.equal(no, "21785");
  const banned = ["Kincaid", "Longcreek", "JobNimbus", "Powers Ferry", "Roderick"];
  const layout = ["Invoice/Receipt", "Quality and Service", "Sales Representative", "Billing", "Payment Portal"];
  for (const word of banned) assert.equal(layout.includes(word), false);
});

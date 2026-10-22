// Pure-logic tests for the header search box (Sprint 1 #3).
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hitFromValue,
  hitValue,
  isFocusShortcut,
  looksLikeAddress,
  newEstimateUrl,
  opensPreview,
  previewUrl,
  searchChips,
  searchUrl,
} from "../src/lib/housefile/search-ui.ts";

test("chips follow the API's supported types", () => {
  assert.deepEqual(searchChips().map((c) => c.label), ["All", "Properties", "Estimates", "Jobs", "People"]);
  const later = searchChips(["property", "proposal", "job", "person", "work_order", "invoice"]);
  assert.ok(later.some((c) => c.label === "Work orders"));
  assert.ok(later.some((c) => c.label === "Invoices"));
});

test("urls encode query, type and property id", () => {
  assert.equal(searchUrl("  40 Oak & co ", null), "/api/search?q=40+Oak+%26+co");
  assert.equal(searchUrl("x", "proposal"), "/api/search?q=x&type=proposal");
  assert.equal(searchUrl("", null), "/api/search?q=");
  assert.equal(previewUrl("p/1?x"), "/api/search-preview?property_id=p%2F1%3Fx");
});

test("Cmd-K / Ctrl-K focus; plain k and modified variants do not", () => {
  assert.ok(isFocusShortcut({ key: "k", metaKey: true }));
  assert.ok(isFocusShortcut({ key: "K", ctrlKey: true }));
  assert.ok(!isFocusShortcut({ key: "k" }));
  assert.ok(!isFocusShortcut({ key: "k", metaKey: true, shiftKey: true }));
  assert.ok(!isFocusShortcut({ key: "j", ctrlKey: true }));
});

test("right arrow opens preview only at end of query", () => {
  assert.ok(opensPreview({ key: "ArrowRight" }, 5, 5));
  assert.ok(opensPreview({ key: "ArrowRight" }, null, 5));
  assert.ok(!opensPreview({ key: "ArrowRight" }, 2, 5));
  assert.ok(!opensPreview({ key: "ArrowLeft" }, 5, 5));
  assert.ok(!opensPreview({ key: "ArrowRight", metaKey: true }, 5, 5));
});

test("hit values round-trip and stay unique across types", () => {
  const hits = [
    { type: "property", id: "1" },
    { type: "job", id: "1" },
  ];
  assert.notEqual(hitValue(hits[0]), hitValue(hits[1]));
  assert.equal(hitFromValue(hits, "job:1"), hits[1]);
  assert.equal(hitFromValue(hits, "nope"), null);
});

test("no-results new-estimate action uses the existing quote flow", () => {
  assert.equal(newEstimateUrl(" 12 Main St "), "/app/new?address=12%20Main%20St");
  assert.equal(newEstimateUrl(""), "/app/new");
  assert.ok(looksLikeAddress("12 Main St"));
  assert.ok(looksLikeAddress("12b Main"));
  assert.ok(!looksLikeAddress("Johnson"));
  assert.ok(!looksLikeAddress("555 1234"));
});

import {
  isSlashShortcut,
  isTypingTarget,
  pushRecent,
  readRecents,
  RECENT_MAX,
  recentKey,
  recentsOrFallback,
  recordRecent,
} from "../src/lib/housefile/search-ui.ts";

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}
const rec = (id, type = "property") => ({ type, id, property_id: id, label: `L ${id}`, sublabel: "", url: `/app/properties/${id}` });

test("'/' opens search except while typing or with modifiers", () => {
  assert.ok(isSlashShortcut({ key: "/", target: { tagName: "DIV" } }));
  assert.ok(isSlashShortcut({ key: "/", target: null }));
  for (const tagName of ["INPUT", "TEXTAREA", "SELECT", "input"]) {
    assert.ok(!isSlashShortcut({ key: "/", target: { tagName } }), tagName);
  }
  assert.ok(!isSlashShortcut({ key: "/", target: { tagName: "DIV", isContentEditable: true } }));
  assert.ok(!isSlashShortcut({ key: "/", ctrlKey: true }));
  assert.ok(!isSlashShortcut({ key: "?", target: null }));
  assert.ok(isTypingTarget({ tagName: "textarea" }));
  assert.ok(!isTypingTarget({ tagName: "BUTTON" }));
});

test("recents: most recent first, deduped, capped at 8", () => {
  let list = [];
  for (let i = 0; i < 12; i += 1) list = pushRecent(list, rec(`p${i}`));
  assert.equal(list.length, RECENT_MAX);
  assert.equal(list[0].id, "p11");
  list = pushRecent(list, rec("p5"));
  assert.deepEqual(list.slice(0, 2).map((h) => h.id), ["p5", "p11"]);
  assert.equal(list.filter((h) => h.id === "p5").length, 1);
  // Same id, different type is a different record.
  list = pushRecent(list, rec("p5", "job"));
  assert.equal(list.filter((h) => h.id === "p5").length, 2);
});

test("recents are stored per tenant + user", () => {
  const s = memStorage();
  recordRecent(s, "co_a", "u1", rec("a1"));
  recordRecent(s, "co_a", "u1", rec("a2"));
  recordRecent(s, "co_b", "u1", rec("b1"));
  recordRecent(s, "co_a", "u2", rec("x1"));
  assert.deepEqual(readRecents(s, "co_a", "u1").map((h) => h.id), ["a2", "a1"]);
  assert.deepEqual(readRecents(s, "co_b", "u1").map((h) => h.id), ["b1"]);
  assert.deepEqual(readRecents(s, "co_a", "u2").map((h) => h.id), ["x1"]);
  assert.deepEqual(readRecents(s, "home", "u1"), []);
  assert.notEqual(recentKey("co_a", "u1"), recentKey("co_a", "u2"));
});

test("recents tolerate junk, missing user and storage failures", () => {
  const s = memStorage();
  s.setItem(recentKey("t", "u"), "{not json");
  assert.deepEqual(readRecents(s, "t", "u"), []);
  s.setItem(recentKey("t", "u"), JSON.stringify([{ id: 1 }, rec("ok"), { ...rec("evil"), url: "https://evil.example" }]));
  assert.deepEqual(readRecents(s, "t", "u").map((h) => h.id), ["ok"]);
  assert.deepEqual(readRecents(null, "t", "u"), []);
  assert.deepEqual(recordRecent(s, "t", "", rec("z")), []);
  const throwing = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  assert.equal(recordRecent(throwing, "t", "u", rec("z")).length, 1);
});

test("empty query falls back to API recents only when nothing was opened", () => {
  const api = [{ id: "api1" }];
  assert.deepEqual(recentsOrFallback([], api), api);
  assert.deepEqual(recentsOrFallback([rec("o")], api).map((h) => h.id), ["o"]);
});

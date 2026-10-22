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

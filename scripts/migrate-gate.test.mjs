import { test } from "node:test";
import assert from "node:assert/strict";
import { migrateDecision } from "./migrate-gate.mjs";

test("production context runs", () => {
  assert.equal(migrateDecision({ CONTEXT: "production", NETLIFY: "true" }).run, true);
});

for (const context of ["deploy-preview", "branch-deploy", "dev"]) {
  test(`${context} context skips with a clear reason`, () => {
    const d = migrateDecision({ CONTEXT: context, NETLIFY: "true" });
    assert.equal(d.run, false);
    assert.equal(d.reason, `skipped: CONTEXT=${context} (only runs in production)`);
  });
}

test("Netlify without CONTEXT fails safe", () => {
  assert.equal(migrateDecision({ NETLIFY: "true" }).run, false);
});

test("local shell (no CONTEXT, not Netlify) runs", () => {
  assert.equal(migrateDecision({}).run, true);
});

test("ALLOW_MIGRATE=1 overrides a preview context", () => {
  assert.equal(migrateDecision({ CONTEXT: "deploy-preview", ALLOW_MIGRATE: "1" }).run, true);
});

test("ALLOW_MIGRATE other than 1 does not override", () => {
  assert.equal(migrateDecision({ CONTEXT: "deploy-preview", ALLOW_MIGRATE: "true" }).run, false);
});

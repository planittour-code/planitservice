import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

// Android webviews / download managers can sniff a text/html response as
// binary when it contains raw 0x00 bytes. Older @tanstack/router-core encoded
// "/" in SSR match ids as "\0", which put NUL bytes into every SSR page
// (including /p/$token and /about). These tests keep them out.

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "package.json"));

async function routerCore() {
  const pkgPath = require.resolve("@tanstack/router-core/package.json");
  const dir = dirname(pkgPath);
  const mod = await import(pathToFileURL(join(dir, "dist/esm/ssr/ssr-match-id.js")).href);
  return { mod, version: JSON.parse(readFileSync(pkgPath, "utf8")).version };
}

const routeIds = [
  ...new Set(
    [...readFileSync(join(root, "src/routeTree.gen.ts"), "utf8").matchAll(/id: '([^']+)'/g)].map(
      (m) => m[1],
    ),
  ),
];

test("route tree includes /p/$token and /about", () => {
  assert.ok(routeIds.includes("/about"));
  assert.ok(routeIds.some((id) => id.startsWith("/p/$token")));
});

test("SSR match ids dehydrate without NUL bytes for every route", async () => {
  const { mod } = await routerCore();
  for (const id of routeIds) {
    // match ids are route id + interpolated path / search hash
    for (const matchId of [id, `${id}/abc123tok/{"q":"x"}`]) {
      const out = mod.dehydrateSsrMatchId(matchId);
      assert.ok(!out.includes("\0"), `NUL byte in dehydrated id for ${id}`);
    }
  }
});

test("rendered SSR payload for /p/$token and /about has no 0x00 bytes", async () => {
  const { mod } = await routerCore();
  for (const id of ["/about", "/p/$token", "/p/$token/accepted"].filter((r) =>
    routeIds.includes(r),
  )) {
    const payload = `<script>$_TSR.h(${JSON.stringify({ i: mod.dehydrateSsrMatchId(id) })})</script>`;
    assert.equal(Buffer.from(payload, "utf8").indexOf(0), -1, `0x00 in payload for ${id}`);
  }
});

test("accepted estimate email leads with View your estimate and marks PDF optional", () => {
  const src = readFileSync(join(root, "src/lib/auth/mail.server.ts"), "utf8");
  const fn = src.slice(src.indexOf("export async function sendAcceptedEstimateEmail"));
  const body = fn.slice(0, fn.indexOf("await sendResendEmail"));
  assert.match(body, /View your estimate/);
  assert.match(body, /Optional: a PDF copy/);
  assert.ok(body.indexOf("View your estimate") < body.indexOf("Total"), "link comes before totals");
  assert.doesNotMatch(body, /The signed estimate is attached as a PDF\./);
});

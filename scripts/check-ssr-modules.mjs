import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ssr = join(process.cwd(), ".netlify", "functions-internal", "server", "_ssr", "ssr.mjs");
if (!existsSync(ssr)) {
  process.stderr.write("SSR module check failed: missing .netlify/functions-internal/server/_ssr/ssr.mjs\n");
  process.exit(1);
}

const source = readFileSync(ssr, "utf8");
if (/\bssr_exports\b/.test(source) && !/\b(?:var|const|let) ssr_exports\b/.test(source)) {
  process.stderr.write("SSR module check failed: ssr.mjs re-exports undeclared ssr_exports.\n");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--check", ssr], { encoding: "utf8" });
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || "ssr.mjs failed node --check\n");
  process.exit(1);
}
console.log("SSR module check passed.");

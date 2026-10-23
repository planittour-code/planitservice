/**
 * Decides whether scripts/migrate.mjs may touch DATABASE_URL.
 *
 * Rule (first match wins):
 *   1. ALLOW_MIGRATE=1            -> run (explicit opt-in, any context).
 *   2. CONTEXT=production         -> run (Netlify production deploy).
 *   3. CONTEXT set to anything else (deploy-preview, branch-deploy, dev, ...)
 *                                 -> skip. Previews must never migrate prod.
 *   4. NETLIFY=true, no CONTEXT   -> skip (unknown Netlify build; fail safe).
 *   5. Otherwise (local shell: CONTEXT unset, not on Netlify) -> run, so
 *      `npm run db:migrate` still works locally.
 */
export function migrateDecision(env = process.env) {
  const context = env.CONTEXT || "";
  if (env.ALLOW_MIGRATE === "1") return { run: true, reason: "ALLOW_MIGRATE=1" };
  if (context === "production") return { run: true, reason: "CONTEXT=production" };
  if (context) {
    return { run: false, reason: `skipped: CONTEXT=${context} (only runs in production)` };
  }
  if (env.NETLIFY === "true") {
    return {
      run: false,
      reason: "skipped: NETLIFY=true but CONTEXT unset (only runs in production)",
    };
  }
  return { run: true, reason: "local (CONTEXT unset, not on Netlify)" };
}

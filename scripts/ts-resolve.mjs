// Test helper: lets plain Node load src/*.ts modules that use extensionless
// relative imports (as Vite/TS do). Import it before any src/*.ts module.
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, next) {
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      try {
        return next(`${specifier}.ts`, context);
      } catch {
        // fall through
      }
    }
    return next(specifier, context);
  },
});

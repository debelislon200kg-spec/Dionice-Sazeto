---
name: Vercel Node ESM imports
description: Environment-specific relative import behavior in Vercel’s transpiled Node runtime.
---

Relative imports in server-side ESM source must use explicit `.js` extensions, including imports of index modules such as `./routes/index.js`. Vercel can transpile workspace TypeScript into a runtime that resolves these imports as native Node ESM; extensionless files and directory imports then fail with `ERR_UNSUPPORTED_DIR_IMPORT` or module-not-found errors.

**Why:** The local esbuild bundle can hide missing ESM extensions, while the Vercel runtime executes transpiled source module paths directly.

**How to apply:** When preparing an Express API or shared server package for Vercel, scan all relative `import` and `export ... from` specifiers in the runtime dependency graph and add `.js` extensions before deployment.
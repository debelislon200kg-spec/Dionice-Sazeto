---
name: Vercel workspace package runtime
description: Runtime behavior of source-only pnpm workspace package exports in Vercel serverless functions
---

Vercel can transpile the API entrypoint while leaving workspace package exports that point to `src/index.ts` unresolved at runtime. A local build may pass because esbuild bundles those packages, but Vercel's deployed Node function can fail with `ERR_MODULE_NOT_FOUND` for the source path.

**Why:** The deployed API loaded compiled route files from `/var/task`, while source-only workspace package targets were not present in the serverless filesystem.

**How to apply:** For code executed directly by a Vercel API function, use compiled package exports or keep the needed runtime module and schema local to the API artifact. Do not rely on a workspace package's `src/index.ts` export merely because the monorepo build succeeds.
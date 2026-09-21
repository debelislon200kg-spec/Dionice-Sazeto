---
name: Vercel Express TypeScript emit
description: Explains the hidden TypeScript failure mode seen when Vercel compiles this monorepo Express API one file at a time.
---

Vercel’s Express builder may type-check individual TypeScript files with an incomplete view of Express declarations. Valid APIs such as router methods, response helpers, app middleware, and server listening can then appear missing even though the workspace typecheck succeeds. With `noEmitOnError` enabled, Vercel suppresses the underlying diagnostics and reports only `<file>: Emit skipped`.

**Why:** The normal workspace TypeScript build and esbuild bundle both passed, while a reproduction of Vercel’s language-service emit returned incomplete Express types and skipped output. Allowing the deployment-only emit to proceed removed the skip without weakening the project’s explicit typecheck command.

**How to apply:** Keep the API’s standalone `pnpm run typecheck` as the source of truth. If Vercel again reports only `Emit skipped`, reproduce its per-file language-service emit and distinguish builder false positives from real diagnostics before changing application logic.

OpenAI SDK v6 imports in shared workspace packages should use the named `OpenAI` export rather than the default import when targeting this Vercel build path. The isolated compiler can treat the default import as the module namespace and report that it has no construct signatures.

**Why:** Vercel’s build reached the shared OpenAI client only after the earlier route and fetch-response issues were fixed; local TypeScript accepted the default import, but Vercel reported `TS2351` for `new OpenAI(...)`.

**How to apply:** Use `import { OpenAI } from "openai"` in server, image, and audio clients; keep `toFile` as a named import.
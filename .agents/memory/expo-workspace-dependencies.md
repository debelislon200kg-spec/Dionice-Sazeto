---
name: Expo workspace dependencies
description: Package installation behavior for Expo artifacts inside the pnpm monorepo.
---

Install Expo-specific packages against the mobile workspace package, for example with a package filter, rather than targeting the repository root.

**Why:** The package-management helper can invoke pnpm at the workspace root and fail with the root-package safety check, even when the dependency belongs only to the Expo artifact.

**How to apply:** Use the mobile package filter for dependency additions, then run the mobile typecheck and Expo dependency check before restarting its managed workflow.
---
name: News source availability
description: Constraints and handling for public publisher feeds used by the market-news refresh flow.
---

Public publisher feeds are not uniformly accessible from the server. Some publishers return access-denied responses or do not expose a stable RSS/Atom endpoint.

**Why:** A live refresh must not turn a blocked or malformed source into fabricated news, and users need to distinguish partial coverage from a complete refresh.

**How to apply:** Keep source-level status and warnings in the refresh response. Add a new feed or HTML parser only after verifying that it returns article-level data; otherwise leave the source unavailable and surface the warning.
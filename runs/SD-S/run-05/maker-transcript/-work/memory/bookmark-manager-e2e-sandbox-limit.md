---
name: bookmark-manager-e2e-sandbox-limit
description: "Playwright E2E can't run in this sandbox (missing OS libs, no root)"
metadata: 
  node_type: memory
  type: project
  originSessionId: aee783c4-7caa-4375-96cd-d2506503e082
---

In the `/work` bookmark-manager project, the Playwright end-to-end test
(`tests/e2e/save-find-open.spec.ts`) is written and correct but **cannot execute
in this sandbox**: launching Chromium fails with `libglib-2.0.so.0: cannot open
shared object file`, and there is no root/passwordless-sudo to `apt-get install`
the browser system deps.

**Why:** headless Chromium needs system shared libraries not present in the
container; installing them requires root we don't have.

**How to apply:** Don't treat an E2E failure here as a code defect. Verify the
covered journeys via the Vitest integration suite (`npm test`, all in-memory) and
live `curl` against a running server (`tsx src/server/index.ts`) instead. The E2E
runs fine on a normal machine via `npx playwright install && npm run test:e2e`.

Also note: `tsx` is not on PATH — invoke `./node_modules/.bin/tsx`.

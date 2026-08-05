---
name: sandbox-no-root-for-chromium
description: "This sandbox can't run Playwright/Chromium — no root to install system libs"
metadata: 
  node_type: memory
  type: reference
  originSessionId: d6541e9a-504e-48d2-a8a3-45a8e34a5911
---

In this environment, Playwright browser binaries download fine but fail to launch:
`chrome-headless-shell: error while loading shared libraries: libglib-2.0.so.0`.
`npx playwright install-deps` fails — no root (su authentication failure).

**How to apply:** Don't rely on browser-driven E2E here; write the specs but use
backend/unit tests + live API (curl/urllib) sweeps as the trustworthy proof, and
tell the user plainly that E2E must run on their own machine. Python venv `pip`
and `npm install`/`vite build` all work (network is available). Related:
[[bookmark-manager-project]].

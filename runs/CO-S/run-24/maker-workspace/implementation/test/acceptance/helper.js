// Test harness for browser-level acceptance tests: starts the real app with a
// deterministic stubbed page-info fetcher and an isolated temp data file, and
// resolves the Playwright install shared by the image.

import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { createHttpServer } from "../../src/app.js";
import { Store } from "../../src/store.js";

const require = createRequire(import.meta.url);

export function loadChromium() {
  const candidates = ["playwright", "/opt/browser-node/node_modules/playwright"];
  for (const c of candidates) {
    try {
      return require(c).chromium;
    } catch (e) {
      /* try next */
    }
  }
  throw new Error("Playwright (playwright@1.61.0) is not available in this environment.");
}

// Deterministic page info: a "private.example" host fails (SCN-006), other hosts
// derive a stable title/description from the path so assertions are predictable.
export function stubInfo(url) {
  if (url.includes("private.example")) return Promise.resolve({ title: "", description: "", ok: false });
  let seg = "";
  try {
    seg = decodeURIComponent(new URL(url).pathname).split("/").filter(Boolean).pop() || "";
  } catch (e) {}
  const title = (seg ? seg.replace(/[-_]+/g, " ") : "Home").replace(/\b\w/g, (c) => c.toUpperCase());
  return Promise.resolve({ title, description: "Auto description for " + title, ok: true });
}

export async function startServer() {
  const dir = await mkdtemp(join(tmpdir(), "bm-acc-"));
  const store = new Store(join(dir, "links.json"));
  await store.load();
  const server = createHttpServer({ store, fetchInfo: stubInfo });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    async close() {
      await new Promise((r) => server.close(r));
      await rm(dir, { recursive: true, force: true });
    },
  };
}

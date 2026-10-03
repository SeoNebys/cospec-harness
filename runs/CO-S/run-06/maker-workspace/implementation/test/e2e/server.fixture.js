// Test server for acceptance tests. Deterministic metadata (no external
// network) and an in-memory store with a reset hook so each scenario controls
// its own starting data.

import { createApp } from "../../src/app.js";
import { Store } from "../../src/store.js";

function fakeFetchMetadata(url) {
  if (url.includes("no-details")) return Promise.resolve({ ok: false });
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } })();
  return Promise.resolve({
    ok: true,
    title: "Title of " + host,
    description: "Auto-filled description for " + host,
  });
}

const store = new Store(null);
const app = createApp({ store, fetchMetadata: fakeFetchMetadata });

// Test-only reset endpoint.
app.post("/api/__reset", (req, res) => {
  store.items = [];
  store.seq = 1;
  res.json({ ok: true });
});

app.listen(4100, "127.0.0.1", () => console.log("test server on 4100"));

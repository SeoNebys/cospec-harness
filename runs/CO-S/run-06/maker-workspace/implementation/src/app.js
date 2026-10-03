// Express application wiring the API + static frontend.
// Exported as a factory so tests can inject a store and a fake metadata fetcher.

import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Store, coerceUrl } from "./store.js";
import { fetchMetadata as realFetchMetadata } from "./metadata.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp({ store, fetchMetadata = realFetchMetadata } = {}) {
  if (!store) throw new Error("createApp requires a store");
  const app = express();
  app.use(express.json());

  const publicDir = join(__dirname, "..", "public");

  // Auto-fill details for a pasted link, and report duplicates (SCN-001/006/007).
  app.post("/api/metadata", async (req, res) => {
    const href = coerceUrl(req.body && req.body.url);
    if (!href) {
      // SCN-006: refuse an invalid link.
      return res.status(400).json({ error: "invalid_url" });
    }
    const existing = store.findByUrl(href);
    let duplicate = null;
    if (existing) {
      duplicate = {
        id: existing.id,
        title: existing.title,
        location: existing.archived ? "archive" : existing.later ? "later" : "all",
      };
    }
    const meta = await fetchMetadata(href);
    // SCN-006: on failure still return ok:true for the URL so the client can
    // let the user type a title and save.
    res.json({
      url: href,
      fetched: meta.ok === true,
      title: meta.ok ? meta.title : "",
      description: meta.ok ? meta.description : "",
      duplicate,
    });
  });

  // List with view + search + tag filter (SCN-002/003/004).
  app.get("/api/bookmarks", (req, res) => {
    const view = ["all", "later", "archive"].includes(req.query.view)
      ? req.query.view
      : "all";
    const items = store.list({ view, q: req.query.q || "", tag: req.query.tag || "" });
    res.json({ view, items, tags: store.tagsForView(view) });
  });

  // Create a bookmark (SCN-001). Guards against duplicates (SCN-007).
  app.post("/api/bookmarks", (req, res) => {
    const body = req.body || {};
    const href = coerceUrl(body.url);
    if (!href) return res.status(400).json({ error: "invalid_url" });
    const existing = store.findByUrl(href);
    if (existing) {
      return res.status(409).json({
        error: "duplicate",
        existing: {
          id: existing.id,
          title: existing.title,
          location: existing.archived ? "archive" : existing.later ? "later" : "all",
        },
      });
    }
    const item = store.create({
      url: href,
      title: body.title,
      note: body.note,
      tags: body.tags,
    });
    res.status(201).json(item);
  });

  // Edit a bookmark in place (SCN-007).
  app.put("/api/bookmarks/:id", (req, res) => {
    const body = req.body || {};
    const item = store.update(req.params.id, {
      title: body.title,
      note: body.note,
      tags: body.tags,
    });
    if (!item) return res.status(404).json({ error: "not_found" });
    res.json(item);
  });

  // Toggle read-later (SCN-003).
  app.post("/api/bookmarks/:id/later", (req, res) => {
    const item = store.setLater(req.params.id, !!(req.body && req.body.later));
    if (!item) return res.status(404).json({ error: "not_found" });
    res.json(item);
  });

  // Archive / restore (SCN-004).
  app.post("/api/bookmarks/:id/archive", (req, res) => {
    const item = store.setArchived(req.params.id, !!(req.body && req.body.archived));
    if (!item) return res.status(404).json({ error: "not_found" });
    res.json(item);
  });

  app.use(express.static(publicDir));
  return app;
}

// Convenience for production startup.
export function createDefaultApp(dataFile) {
  const store = new Store(dataFile);
  return createApp({ store });
}

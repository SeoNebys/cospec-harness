// Express application wiring the HTTP API to the store + metadata reader.
// Exported as a factory so tests can inject a store and a fake fetch.
//
// Endpoints (all under /api):
//   GET    /bookmarks           list all (frontend filters by view)
//   POST   /bookmarks           save a link {url}          (SCN-001, SCN-007)
//   PATCH  /bookmarks/:id       edit fields / status / archived (SCN-002/004/005/008)
//   DELETE /bookmarks/:id       permanent delete           (SCN-009)

import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isValidHttpUrl, siteFromUrl, normalizeUrlForCompare } from "../public/js/shared.mjs";
import { readPageDetails } from "./metadata.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

const VALID_STATUS = new Set(["to-read", "finished"]);

function newId() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

function sanitizeTags(tags) {
  if (!Array.isArray(tags)) return undefined;
  const out = [];
  for (const t of tags) {
    if (typeof t !== "string") continue;
    const v = t.trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

export function createApp({ store, fetchImpl } = {}) {
  const app = express();
  app.use(express.json());
  app.use(express.static(PUBLIC_DIR));

  app.get("/api/bookmarks", (req, res) => {
    res.json(store.all());
  });

  app.post("/api/bookmarks", async (req, res) => {
    const url = normalizeUrlForCompare(req.body && req.body.url);
    if (!isValidHttpUrl(url)) {
      return res
        .status(400)
        .json({ error: "invalid_url", message: "That doesn't look like a web address." });
    }
    const existing = store.findByUrl(url);
    if (existing) {
      return res
        .status(409)
        .json({ error: "duplicate", message: "You've already saved this link.", bookmark: existing });
    }
    const details = await readPageDetails(url, { fetchImpl });
    const bookmark = {
      id: newId(),
      url,
      title: details.title,
      site: details.site,
      description: details.description || "",
      tags: [],
      note: "",
      status: "to-read", // new links start as "to read" (SCN-004)
      archived: false,
      unreadable: !!details.unreadable, // (SCN-007)
      savedAt: new Date().toISOString(),
    };
    await store.add(bookmark);
    res.status(201).json(bookmark);
  });

  app.patch("/api/bookmarks/:id", async (req, res) => {
    const bm = store.findById(req.params.id);
    if (!bm) return res.status(404).json({ error: "not_found" });

    const body = req.body || {};
    const patch = {};

    if (body.url !== undefined) {
      const url = normalizeUrlForCompare(body.url);
      if (!isValidHttpUrl(url)) {
        return res
          .status(400)
          .json({ error: "invalid_url", message: "That doesn't look like a web address." });
      }
      const clash = store.findByUrl(url);
      if (clash && clash.id !== bm.id) {
        return res
          .status(409)
          .json({ error: "duplicate", message: "Another bookmark already uses this link.", bookmark: clash });
      }
      patch.url = url;
      patch.site = siteFromUrl(url);
      patch.unreadable = false; // the client has taken the address in hand
    }
    if (typeof body.title === "string") patch.title = body.title.trim() || bm.title;
    if (typeof body.description === "string") patch.description = body.description.trim();
    if (typeof body.note === "string") patch.note = body.note.trim();

    const tags = sanitizeTags(body.tags);
    if (tags !== undefined) patch.tags = tags;

    if (body.status !== undefined) {
      if (!VALID_STATUS.has(body.status))
        return res.status(400).json({ error: "invalid_status" });
      patch.status = body.status;
    }
    if (body.archived !== undefined) patch.archived = !!body.archived;

    const updated = await store.update(bm.id, patch);
    res.json(updated);
  });

  app.delete("/api/bookmarks/:id", async (req, res) => {
    const ok = await store.remove(req.params.id); // permanent (SCN-009)
    if (!ok) return res.status(404).json({ error: "not_found" });
    res.status(204).end();
  });

  return app;
}

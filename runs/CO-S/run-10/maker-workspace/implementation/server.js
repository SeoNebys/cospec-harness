// HTTP server: serves the web client and a small JSON API.
// Listens on 0.0.0.0 so it is reachable in the shared review environment.

import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Store } from "./src/store.js";
import { BookmarkService } from "./src/bookmarks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp(service) {
  const app = express();
  app.use(express.json());
  app.use(express.static(join(__dirname, "public")));

  app.get("/api/bookmarks", (req, res) => {
    res.json({ bookmarks: service.list() });
  });

  app.post("/api/bookmarks", async (req, res) => {
    const result = await service.create(req.body && req.body.url);
    if (result.ok) return res.status(201).json({ bookmark: result.bookmark });
    if (result.code === "invalid") {
      return res.status(400).json({ error: "invalid", message: "That doesn't look like a valid link." });
    }
    if (result.code === "duplicate") {
      return res.status(409).json({
        error: "duplicate",
        existing: result.existing,
        archived: result.archived,
      });
    }
    return res.status(500).json({ error: "unknown" });
  });

  app.patch("/api/bookmarks/:id", (req, res) => {
    const result = service.update(Number(req.params.id), req.body || {});
    if (result.ok) return res.json({ bookmark: result.bookmark });
    return res.status(404).json({ error: "not_found" });
  });

  app.delete("/api/bookmarks/:id", (req, res) => {
    const result = service.remove(Number(req.params.id));
    if (result.ok) return res.status(204).end();
    return res.status(404).json({ error: "not_found" });
  });

  return app;
}

// Start the server only when run directly (not when imported by tests).
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const dataFile = process.env.DATA_FILE || join(__dirname, "data", "bookmarks.json");
  const service = new BookmarkService(new Store(dataFile));
  const port = Number(process.env.PORT || 4000);
  createApp(service).listen(port, "0.0.0.0", () => {
    console.log(`Bookmarks app listening on http://0.0.0.0:${port}`);
  });
}

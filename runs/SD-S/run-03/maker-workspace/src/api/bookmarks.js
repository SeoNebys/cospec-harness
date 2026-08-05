import { Router } from "express";
import { isValidHttpUrl } from "../models/bookmark.js";

/**
 * HTTP routes for bookmarks. Dependencies are injected so tests can supply an
 * in-memory model and a stubbed title fetcher.
 */
export function createBookmarksRouter({ model, titleFetcher }) {
  const router = Router();

  // GET /api/bookmarks?q=&tag=&sort=  — list, search, filter, order
  router.get("/bookmarks", (req, res) => {
    const { q, tag, sort } = req.query;
    res.json({ bookmarks: model.list({ q, tag, sort }) });
  });

  // GET /api/tags — all tag names in use
  router.get("/tags", (_req, res) => {
    res.json({ tags: model.listTags() });
  });

  // GET /api/bookmarks/:id
  router.get("/bookmarks/:id", (req, res) => {
    const bookmark = model.getById(Number(req.params.id));
    if (!bookmark) return res.status(404).json({ error: "not_found" });
    res.json({ bookmark });
  });

  // POST /api/bookmarks — create
  router.post("/bookmarks", async (req, res, next) => {
    try {
      const { url, title, note, tags, confirmDuplicate } = req.body || {};

      if (!isValidHttpUrl(url)) {
        return res.status(400).json({ error: "invalid_url" });
      }

      // Duplicate detection (FR-013): warn unless the client opts to override.
      if (!confirmDuplicate) {
        const existing = model.findByUrl(url);
        if (existing) {
          return res.status(409).json({ error: "duplicate", existing });
        }
      }

      // Best-effort auto-title when none supplied (FR-003).
      let resolvedTitle = typeof title === "string" ? title.trim() : "";
      if (!resolvedTitle) {
        try {
          resolvedTitle = (await titleFetcher(url)) || "";
        } catch {
          resolvedTitle = "";
        }
      }

      const bookmark = model.create({ url, title: resolvedTitle, note, tags });
      res.status(201).json({ bookmark });
    } catch (err) {
      next(err);
    }
  });

  // PUT /api/bookmarks/:id — update url/title/note/tags (FR-011)
  router.put("/bookmarks/:id", (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const { url, title, note, tags } = req.body || {};

      if (url !== undefined && !isValidHttpUrl(url)) {
        return res.status(400).json({ error: "invalid_url" });
      }

      const patch = {};
      if (url !== undefined) patch.url = url;
      if (title !== undefined) patch.title = title;
      if (note !== undefined) patch.note = note;
      if (tags !== undefined) patch.tags = tags;

      const bookmark = model.update(id, patch);
      if (!bookmark) return res.status(404).json({ error: "not_found" });
      res.json({ bookmark });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/bookmarks/:id (FR-012; UI enforces the confirmation step)
  router.delete("/bookmarks/:id", (req, res) => {
    const removed = model.delete(Number(req.params.id));
    if (!removed) return res.status(404).json({ error: "not_found" });
    res.status(204).end();
  });

  return router;
}

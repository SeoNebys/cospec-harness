import express from "express";
import cors from "cors";
import {
  listBookmarks,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  listTags,
} from "./bookmarks.ts";
import { fetchPageTitle } from "./fetchTitle.ts";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT ?? 3001);

function isValidUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

app.get("/api/bookmarks", (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const tag = typeof req.query.tag === "string" ? req.query.tag : undefined;
  res.json(listBookmarks({ search, tag }));
});

app.post("/api/bookmarks", (req, res) => {
  const { url, title, notes, tags } = req.body ?? {};
  if (!isValidUrl(url)) {
    return res.status(400).json({ error: "A valid http(s) URL is required." });
  }
  res.status(201).json(createBookmark({ url, title, notes, tags }));
});

app.put("/api/bookmarks/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Bad id." });
  const { url, title, notes, tags } = req.body ?? {};
  if (!isValidUrl(url)) {
    return res.status(400).json({ error: "A valid http(s) URL is required." });
  }
  const updated = updateBookmark(id, { url, title, notes, tags });
  if (!updated) return res.status(404).json({ error: "Not found." });
  res.json(updated);
});

app.delete("/api/bookmarks/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Bad id." });
  const ok = deleteBookmark(id);
  if (!ok) return res.status(404).json({ error: "Not found." });
  res.status(204).end();
});

app.get("/api/tags", (_req, res) => {
  res.json(listTags());
});

app.post("/api/fetch-title", async (req, res) => {
  const { url } = req.body ?? {};
  if (!isValidUrl(url)) {
    return res.status(400).json({ error: "A valid http(s) URL is required." });
  }
  const title = await fetchPageTitle(url);
  res.json({ title });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});

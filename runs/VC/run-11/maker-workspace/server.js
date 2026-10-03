import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFile, writeFile, mkdir } from "fs/promises";
import { randomUUID } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
const DATA_FILE = join(DATA_DIR, "bookmarks.json");

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

async function load() {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function save(bookmarks) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(bookmarks, null, 2));
}

function normalizeUrl(url) {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return "https://" + trimmed;
}

function parseTags(tags) {
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

app.get("/api/bookmarks", async (req, res) => {
  const bookmarks = await load();
  res.json(bookmarks);
});

app.post("/api/bookmarks", async (req, res) => {
  const { title, url, description, tags } = req.body || {};
  const normUrl = normalizeUrl(url);
  if (!normUrl) return res.status(400).json({ error: "URL is required" });
  const bookmarks = await load();
  const bookmark = {
    id: randomUUID(),
    title: (title || "").trim() || normUrl,
    url: normUrl,
    description: (description || "").trim(),
    tags: parseTags(tags),
    createdAt: new Date().toISOString(),
  };
  bookmarks.unshift(bookmark);
  await save(bookmarks);
  res.status(201).json(bookmark);
});

app.put("/api/bookmarks/:id", async (req, res) => {
  const bookmarks = await load();
  const idx = bookmarks.findIndex((b) => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  const { title, url, description, tags } = req.body || {};
  const normUrl = normalizeUrl(url);
  if (!normUrl) return res.status(400).json({ error: "URL is required" });
  bookmarks[idx] = {
    ...bookmarks[idx],
    title: (title || "").trim() || normUrl,
    url: normUrl,
    description: (description || "").trim(),
    tags: parseTags(tags),
  };
  await save(bookmarks);
  res.json(bookmarks[idx]);
});

app.delete("/api/bookmarks/:id", async (req, res) => {
  const bookmarks = await load();
  const next = bookmarks.filter((b) => b.id !== req.params.id);
  if (next.length === bookmarks.length)
    return res.status(404).json({ error: "Not found" });
  await save(next);
  res.status(204).end();
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Bookmark manager listening on http://0.0.0.0:${PORT}`);
});

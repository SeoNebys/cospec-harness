import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data", "bookmarks.json");
const PORT = process.env.PORT || 4000;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- Persistence -----------------------------------------------------------

async function ensureStore() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]", "utf8");
  }
}

async function readAll() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(bookmarks) {
  const tmp = DATA_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(bookmarks, null, 2), "utf8");
  await fs.rename(tmp, DATA_FILE);
}

// --- Helpers ---------------------------------------------------------------

function normalizeUrl(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return "https://" + trimmed;
}

function isValidUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function parseTags(tags) {
  if (Array.isArray(tags)) {
    return [...new Set(tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))];
  }
  if (typeof tags === "string") {
    return [...new Set(tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))];
  }
  return [];
}

function sanitize(body) {
  const url = normalizeUrl(body.url);
  if (!isValidUrl(url)) {
    return { error: "A valid http(s) URL is required." };
  }
  const title = String(body.title || "").trim() || url;
  const description = String(body.description || "").trim();
  const tags = parseTags(body.tags);
  return { value: { url, title, description, tags } };
}

// --- Routes ----------------------------------------------------------------

app.get("/api/bookmarks", async (req, res) => {
  const bookmarks = await readAll();
  bookmarks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  res.json(bookmarks);
});

app.post("/api/bookmarks", async (req, res) => {
  const { value, error } = sanitize(req.body || {});
  if (error) return res.status(400).json({ error });
  const bookmarks = await readAll();
  const now = Date.now();
  const bookmark = {
    id: crypto.randomUUID(),
    ...value,
    createdAt: now,
    updatedAt: now,
  };
  bookmarks.push(bookmark);
  await writeAll(bookmarks);
  res.status(201).json(bookmark);
});

app.put("/api/bookmarks/:id", async (req, res) => {
  const { value, error } = sanitize(req.body || {});
  if (error) return res.status(400).json({ error });
  const bookmarks = await readAll();
  const idx = bookmarks.findIndex((b) => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Bookmark not found." });
  bookmarks[idx] = { ...bookmarks[idx], ...value, updatedAt: Date.now() };
  await writeAll(bookmarks);
  res.json(bookmarks[idx]);
});

app.delete("/api/bookmarks/:id", async (req, res) => {
  const bookmarks = await readAll();
  const next = bookmarks.filter((b) => b.id !== req.params.id);
  if (next.length === bookmarks.length) {
    return res.status(404).json({ error: "Bookmark not found." });
  }
  await writeAll(next);
  res.status(204).end();
});

// --- Boot ------------------------------------------------------------------

await ensureStore();
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Bookmark manager listening on http://0.0.0.0:${PORT}`);
});

// Simple, dependency-free JSON file store with atomic writes.
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";

const DATA_FILE = process.env.DATA_FILE || "/work/data/bookmarks.json";

let cache = null;
let writeChain = Promise.resolve();

async function ensureLoaded() {
  if (cache) return cache;
  await mkdir(dirname(DATA_FILE), { recursive: true });
  if (existsSync(DATA_FILE)) {
    try {
      cache = JSON.parse(await readFile(DATA_FILE, "utf8"));
      if (!Array.isArray(cache.bookmarks)) cache = { bookmarks: [] };
    } catch {
      cache = { bookmarks: [] };
    }
  } else {
    cache = { bookmarks: seed() };
    await persist();
  }
  return cache;
}

function persist() {
  // Serialize writes so concurrent requests can't corrupt the file.
  writeChain = writeChain.then(async () => {
    const tmp = `${DATA_FILE}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(cache, null, 2), "utf8");
    await rename(tmp, DATA_FILE);
  });
  return writeChain;
}

function seed() {
  const now = new Date().toISOString();
  const mk = (url, title, description, tags) => ({
    id: randomUUID(),
    url,
    title,
    description,
    tags,
    createdAt: now,
    updatedAt: now,
  });
  return [
    mk(
      "https://developer.mozilla.org/",
      "MDN Web Docs",
      "Reference for web platform APIs, HTML, CSS and JavaScript.",
      ["reference", "webdev"]
    ),
    mk(
      "https://news.ycombinator.com/",
      "Hacker News",
      "Tech and startup news aggregator.",
      ["news", "tech"]
    ),
    mk(
      "https://nodejs.org/docs/latest/api/",
      "Node.js API Docs",
      "Official documentation for the Node.js runtime.",
      ["reference", "node", "webdev"]
    ),
  ];
}

function normalizeTags(tags) {
  if (!tags) return [];
  const arr = Array.isArray(tags)
    ? tags
    : String(tags).split(",");
  const seen = new Set();
  const out = [];
  for (let t of arr) {
    t = String(t).trim().toLowerCase();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

function normalizeUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) throw new ValidationError("URL is required.");
  let candidate = raw;
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new ValidationError("That does not look like a valid URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ValidationError("Only http and https URLs are supported.");
  }
  return parsed.toString();
}

export class ValidationError extends Error {}

export async function list({ q = "", tag = "" } = {}) {
  const { bookmarks } = await ensureLoaded();
  const query = q.trim().toLowerCase();
  const tagFilter = tag.trim().toLowerCase();
  let result = bookmarks.slice();
  if (tagFilter) {
    result = result.filter((b) => b.tags.includes(tagFilter));
  }
  if (query) {
    result = result.filter((b) => {
      const hay = `${b.title} ${b.description} ${b.url} ${b.tags.join(" ")}`.toLowerCase();
      return hay.includes(query);
    });
  }
  result.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return result;
}

export async function allTags() {
  const { bookmarks } = await ensureLoaded();
  const counts = new Map();
  for (const b of bookmarks) {
    for (const t of b.tags) counts.set(t, (counts.get(t) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function create({ url, title, description, tags }) {
  const store = await ensureLoaded();
  const normalizedUrl = normalizeUrl(url);
  const now = new Date().toISOString();
  const bookmark = {
    id: randomUUID(),
    url: normalizedUrl,
    title: String(title || "").trim() || hostnameOf(normalizedUrl),
    description: String(description || "").trim(),
    tags: normalizeTags(tags),
    createdAt: now,
    updatedAt: now,
  };
  store.bookmarks.push(bookmark);
  await persist();
  return bookmark;
}

export async function update(id, { url, title, description, tags }) {
  const store = await ensureLoaded();
  const b = store.bookmarks.find((x) => x.id === id);
  if (!b) return null;
  if (url !== undefined) b.url = normalizeUrl(url);
  if (title !== undefined) b.title = String(title).trim() || hostnameOf(b.url);
  if (description !== undefined) b.description = String(description).trim();
  if (tags !== undefined) b.tags = normalizeTags(tags);
  b.updatedAt = new Date().toISOString();
  await persist();
  return b;
}

export async function remove(id) {
  const store = await ensureLoaded();
  const idx = store.bookmarks.findIndex((x) => x.id === id);
  if (idx === -1) return false;
  store.bookmarks.splice(idx, 1);
  await persist();
  return true;
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

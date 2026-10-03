import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { LibraryStore } from "./lib/store.js";
import { cleanUrl, normalizeUrl, siteName } from "./lib/url.js";
import { sanitizeNoteHtml } from "./lib/sanitize.js";
import { gatherMetadata } from "./lib/metadata.js";
import { applyImport, inspectImport, makeBackup, makeBrowserExport } from "./lib/transfer.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, "public");

function json(response, status, body, headers = {}) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  response.end(JSON.stringify(body));
}

function text(response, status, body, contentType, headers = {}) {
  response.writeHead(status, { "content-type": contentType, ...headers });
  response.end(body);
}

async function bodyJson(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 12_000_000) throw Object.assign(new Error("Request is too large."), { status: 413 });
  }
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error("Invalid request."), { status: 400 }); }
}

function allLabels(bookmarks) {
  return [...new Set(bookmarks.flatMap((bookmark) => bookmark.labels || []))];
}

function canonicalizeLabels(values, bookmarks) {
  const existing = allLabels(bookmarks);
  const result = [];
  for (const raw of values || []) {
    const cleaned = String(raw || "").trim().slice(0, 80);
    if (!cleaned) continue;
    const canonical = existing.find((label) => label.toLowerCase() === cleaned.toLowerCase()) || cleaned;
    if (!result.some((label) => label.toLowerCase() === canonical.toLowerCase())) result.push(canonical);
  }
  return result;
}

function bookmarkPayload(input, current, bookmarks) {
  const url = cleanUrl(input.url ?? current?.url);
  const title = String(input.title ?? current?.title ?? "").trim().slice(0, 500);
  if (!title) throw Object.assign(new Error("Give this bookmark a title before saving."), { status: 400 });
  const now = new Date().toISOString();
  return {
    id: current?.id || randomUUID(), url, normalizedUrl: normalizeUrl(url),
    siteName: String(input.siteName ?? current?.siteName ?? siteName(url)).trim().slice(0, 200) || siteName(url),
    title,
    description: String(input.description ?? current?.description ?? "").trim().slice(0, 4000),
    favicon: String(input.favicon ?? current?.favicon ?? "").slice(0, 4000),
    previewImage: String(input.previewImage ?? current?.previewImage ?? "").slice(0, 4000),
    labels: canonicalizeLabels(input.labels ?? current?.labels ?? [], bookmarks),
    noteHtml: sanitizeNoteHtml(input.noteHtml ?? current?.noteHtml ?? ""),
    readLater: Boolean(input.readLater ?? current?.readLater),
    archived: Boolean(input.archived ?? current?.archived),
    savedAt: current?.savedAt || (input.savedAt && !Number.isNaN(Date.parse(input.savedAt)) ? new Date(input.savedAt).toISOString() : now),
    updatedAt: now
  };
}

function publicPath(urlPath) {
  const requested = urlPath === "/" ? "index.html" : decodeURIComponent(urlPath.replace(/^\//, ""));
  const resolved = path.resolve(publicDir, requested);
  return resolved.startsWith(`${publicDir}${path.sep}`) || resolved === path.join(publicDir, "index.html") ? resolved : null;
}

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" };

export async function createKeepsakeServer({ dataFile = path.join(here, "data", "library.json"), metadataReader = gatherMetadata } = {}) {
  const store = new LibraryStore(dataFile);
  await store.init();
  const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const route = requestUrl.pathname;
    try {
      if (route === "/api/library" && request.method === "GET") return json(response, 200, store.snapshot());

      if (route === "/api/metadata" && request.method === "POST") {
        const input = await bodyJson(request);
        const url = cleanUrl(input.url);
        const key = normalizeUrl(url);
        const existing = store.snapshot().bookmarks.find((bookmark) => bookmark.normalizedUrl === key);
        if (existing) return json(response, 200, { duplicate: true, bookmark: existing });
        const metadata = await metadataReader(url);
        return json(response, 200, { duplicate: false, ...metadata, normalizedUrl: key });
      }

      if (route === "/api/bookmarks" && request.method === "POST") {
        const input = await bodyJson(request);
        const key = normalizeUrl(input.url);
        const existing = store.snapshot().bookmarks.find((bookmark) => bookmark.normalizedUrl === key);
        if (existing) return json(response, 409, { error: "This page is already in your library.", bookmark: existing });
        const created = await store.mutate((data) => {
          const bookmark = bookmarkPayload(input, null, data.bookmarks);
          data.bookmarks.push(bookmark);
          return bookmark;
        });
        return json(response, 201, { bookmark: created });
      }

      const bookmarkMatch = route.match(/^\/api\/bookmarks\/([^/]+)$/);
      if (bookmarkMatch && request.method === "PATCH") {
        const input = await bodyJson(request);
        const updated = await store.mutate((data) => {
          const index = data.bookmarks.findIndex((bookmark) => bookmark.id === bookmarkMatch[1]);
          if (index < 0) throw Object.assign(new Error("Bookmark not found."), { status: 404 });
          const candidate = bookmarkPayload(input, data.bookmarks[index], data.bookmarks);
          const duplicate = data.bookmarks.find((bookmark, otherIndex) => otherIndex !== index && bookmark.normalizedUrl === candidate.normalizedUrl);
          if (duplicate) throw Object.assign(new Error("Another bookmark already uses this address."), { status: 409, bookmark: duplicate });
          data.bookmarks[index] = candidate;
          return candidate;
        });
        return json(response, 200, { bookmark: updated });
      }
      if (bookmarkMatch && request.method === "DELETE") {
        const removed = await store.mutate((data) => {
          const index = data.bookmarks.findIndex((bookmark) => bookmark.id === bookmarkMatch[1]);
          if (index < 0) throw Object.assign(new Error("Bookmark not found."), { status: 404 });
          return data.bookmarks.splice(index, 1)[0];
        });
        return json(response, 200, { bookmark: removed });
      }

      if (route === "/api/bulk" && request.method === "POST") {
        const input = await bodyJson(request);
        const ids = new Set(Array.isArray(input.ids) ? input.ids : []);
        if (!ids.size) throw Object.assign(new Error("Select at least one bookmark."), { status: 400 });
        const result = await store.mutate((data) => {
          const targets = data.bookmarks.filter((bookmark) => ids.has(bookmark.id));
          if (!targets.length) throw Object.assign(new Error("No selected bookmarks were found."), { status: 404 });
          if (input.action === "delete") data.bookmarks = data.bookmarks.filter((bookmark) => !ids.has(bookmark.id));
          else {
            const canonicalLabel = input.action === "label"
              ? canonicalizeLabels([input.label], data.bookmarks)[0]
              : "";
            if (input.action === "label" && !canonicalLabel) throw Object.assign(new Error("Enter a label."), { status: 400 });
            for (const bookmark of targets) {
              if (input.action === "label" && !bookmark.labels.some((label) => label.toLowerCase() === canonicalLabel.toLowerCase())) bookmark.labels.push(canonicalLabel);
              else if (input.action === "read-later") bookmark.readLater = true;
              else if (input.action === "mark-read") bookmark.readLater = false;
              else if (input.action === "archive") bookmark.archived = true;
              else if (input.action !== "label") throw Object.assign(new Error("Unknown batch action."), { status: 400 });
              bookmark.updatedAt = new Date().toISOString();
            }
          }
          return { count: targets.length, bookmarks: data.bookmarks };
        });
        return json(response, 200, result);
      }

      if (route === "/api/import/preview" && request.method === "POST") {
        const input = await bodyJson(request);
        return json(response, 200, inspectImport(input.content, input.fileName, store.snapshot().bookmarks));
      }
      if (route === "/api/import/apply" && request.method === "POST") {
        const input = await bodyJson(request);
        const result = await store.mutate((data) => {
          const imported = applyImport(input.content, input.fileName, data.bookmarks);
          data.bookmarks = imported.bookmarks;
          return imported;
        });
        return json(response, 200, result);
      }

      if (route === "/api/export/browser" && request.method === "GET") {
        const stamp = new Date().toISOString().slice(0, 10);
        return text(response, 200, makeBrowserExport(store.snapshot().bookmarks), "text/html; charset=utf-8", {
          "content-disposition": `attachment; filename="keepsake-bookmarks-${stamp}.html"`
        });
      }
      if (route === "/api/export/backup" && request.method === "GET") {
        const stamp = new Date().toISOString().slice(0, 10);
        return text(response, 200, `${JSON.stringify(makeBackup(store.snapshot().bookmarks), null, 2)}\n`, "application/json; charset=utf-8", {
          "content-disposition": `attachment; filename="keepsake-library-${stamp}.json"`
        });
      }

      if (request.method !== "GET" && request.method !== "HEAD") return json(response, 404, { error: "Not found." });
      const filePath = publicPath(route);
      if (!filePath) return json(response, 404, { error: "Not found." });
      try {
        const content = await readFile(filePath);
        response.writeHead(200, {
          "content-type": MIME[path.extname(filePath)] || "application/octet-stream",
          "cache-control": route === "/" ? "no-cache" : "public, max-age=300",
          "content-security-policy": "default-src 'self'; img-src 'self' https: http: data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'"
        });
        response.end(request.method === "HEAD" ? undefined : content);
      } catch (error) {
        if (error.code === "ENOENT") return json(response, 404, { error: "Not found." });
        throw error;
      }
    } catch (error) {
      const status = error.status || (error instanceof SyntaxError ? 400 : 500);
      const payload = { error: status >= 500 ? "Something went wrong." : error.message };
      if (error.bookmark) payload.bookmark = error.bookmark;
      json(response, status, payload);
    }
  });
  return { server, store };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4000);
  const dataFile = process.env.KEEPSAKE_DATA_FILE || path.join(here, "data", "library.json");
  const { server } = await createKeepsakeServer({ dataFile });
  server.listen(port, "0.0.0.0", () => console.log(`Keepsake is ready on port ${port}`));
}

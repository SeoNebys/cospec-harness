// Reads a browser's exported bookmarks file (Netscape format) and plans the import
// (SCN-015). Parser is hand-rolled (no DOMParser) so the trust-critical mapping is
// unit-testable in Node. Nothing is committed here — this only produces a plan the
// UI shows for confirmation.
import { normalizeUrl, hostOf } from "./model.js";

// Top-level browser wrappers that must NOT become labels.
export const CONTAINER_FOLDERS = new Set([
  "bookmarks bar", "bookmarks menu", "other bookmarks", "bookmarks toolbar",
  "favorites bar", "favorites", "bookmarks", "toolbar", "mobile bookmarks",
  "bookmarks toolbar folder",
]);

function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/gi, "'")
    .replace(/&amp;/g, "&");
}
function attr(attrsText, name) {
  const m = new RegExp(name + '\\s*=\\s*"([^"]*)"', "i").exec(attrsText);
  return m ? m[1] : null;
}

// -> [{ url, title, savedAt(ms|0), folders:[outer..inner] }]
export function parseBookmarksHtml(text) {
  const out = [];
  const folderStack = [];
  const dlIsFolder = []; // parallel to open <DL>s: did this DL push a folder?
  let pendingFolder = null;

  const re = /<h3[^>]*>([\s\S]*?)<\/h3>|<a\s+([^>]*?)>([\s\S]*?)<\/a>|<dl\b[^>]*>|<\/dl\s*>/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const tag = m[0].toLowerCase();
    if (tag.startsWith("<h3")) {
      pendingFolder = decodeEntities(m[1].replace(/<[^>]*>/g, "")).trim();
    } else if (tag.startsWith("<a")) {
      const href = attr(m[2], "href") || "";
      if (/^https?:/i.test(href)) {
        const ad = attr(m[2], "add_date");
        out.push({
          url: href,
          title: decodeEntities(m[3].replace(/<[^>]*>/g, "")).trim(),
          savedAt: ad ? parseInt(ad, 10) * 1000 : 0,
          folders: [...folderStack],
        });
      }
    } else if (tag.startsWith("<dl")) {
      if (pendingFolder != null && !CONTAINER_FOLDERS.has(pendingFolder.trim().toLowerCase())) {
        folderStack.push(pendingFolder);
        dlIsFolder.push(true);
      } else {
        // root DL, or a browser container wrapper we don't treat as a label
        dlIsFolder.push(false);
      }
      pendingFolder = null;
    } else {
      // </dl>
      if (dlIsFolder.pop()) folderStack.pop();
    }
  }
  return out;
}

// Turn a folder path into canonical labels: drop container wrappers, keep BOTH
// levels of nesting, merge capitalisation via the shared label index.
export function foldersToLabels(folders, labelIndex) {
  const seen = new Set();
  const labels = [];
  for (const f of folders) {
    if (!f || CONTAINER_FOLDERS.has(f.trim().toLowerCase())) continue;
    const c = labelIndex.canon(f);
    if (c && !seen.has(c)) { seen.add(c); labels.push(c); }
  }
  return labels;
}

// Merge duplicate URLs within the incoming file, accumulating their folders.
function coalesce(raw) {
  const map = new Map();
  for (const x of raw) {
    const id = normalizeUrl(x.url);
    if (!id) continue;
    if (map.has(id)) {
      const e = map.get(id);
      (x.folders || []).forEach((f) => { if (!e.folders.includes(f)) e.folders.push(f); });
      if (!e.title && x.title) e.title = x.title;
      if (!e.savedAt && x.savedAt) e.savedAt = x.savedAt;
    } else {
      map.set(id, { url: x.url, title: x.title, savedAt: x.savedAt || 0, folders: [...(x.folders || [])] });
    }
  }
  return [...map.values()];
}

// Build the import plan. `labelIndex` is created from the client's existing labels
// so imported folders merge into them (case-insensitively). Returns fresh item
// drafts plus stats for the preview.
export function planImport(raw, existingItems, labelIndex, nowMs = 0) {
  const existingIds = new Set(existingItems.map((it) => it.id));
  const merged = coalesce(raw);

  let dupes = 0, caseMerges = 0, keptTitles = 0;
  const labelSet = new Set();
  const dates = [];
  const fresh = [];

  for (const x of merged) {
    const id = normalizeUrl(x.url);
    if (existingIds.has(id)) { dupes++; continue; }
    // count a case-merge before canon registers the new spelling
    for (const f of x.folders) {
      if (f && !CONTAINER_FOLDERS.has(f.trim().toLowerCase()) && labelIndex.isCaseMerge(f)) caseMerges++;
    }
    const labels = foldersToLabels(x.folders, labelIndex);
    labels.forEach((l) => labelSet.add(l));
    const hasOwnTitle = x.title && !/^https?:/i.test(x.title);
    if (hasOwnTitle) keptTitles++;
    if (x.savedAt) dates.push(x.savedAt);
    fresh.push({
      id,
      url: x.url,
      host: hostOf(x.url),
      title: hasOwnTitle ? x.title : x.url,
      summary: "",
      note: "",
      labels,
      toRead: false,
      read: false,
      archived: false,
      savedAt: x.savedAt || nowMs,
      needsName: !hasOwnTitle,
    });
  }

  return {
    fresh,
    stats: {
      total: merged.length,
      fresh: fresh.length,
      dupes,
      caseMerges,
      keptTitles,
      labels: [...labelSet].sort(),
      dateFrom: dates.length ? Math.min(...dates) : null,
      dateTo: dates.length ? Math.max(...dates) : null,
    },
  };
}

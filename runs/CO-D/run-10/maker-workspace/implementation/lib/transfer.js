import { randomUUID } from "node:crypto";
import { normalizeUrl, cleanUrl, siteName } from "./url.js";
import { sanitizeNoteHtml } from "./sanitize.js";

function decodeHtml(value = "") {
  return value
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function htmlEscape(value = "") {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? decodeHtml(match[1] ?? match[2] ?? match[3] ?? "") : "";
}

export function parseBrowserBookmarks(content) {
  const tokens = [...String(content).matchAll(/<DT>\s*<H3\b[^>]*>[\s\S]*?<\/H3>|<DT>\s*<A\b[^>]*>[\s\S]*?<\/A>|<DL\b[^>]*>|<\/DL>/gi)].map((match) => match[0]);
  const folders = [];
  const entries = [];
  let pendingFolder = "";
  for (const token of tokens) {
    if (/^<DT>\s*<H3/i.test(token)) {
      pendingFolder = decodeHtml(token.replace(/^<DT>\s*<H3\b[^>]*>/i, "").replace(/<\/H3>$/i, ""));
    } else if (/^<DL/i.test(token)) {
      if (pendingFolder) folders.push(pendingFolder);
      pendingFolder = "";
    } else if (/^<\/DL/i.test(token)) {
      folders.pop();
    } else if (/^<DT>\s*<A/i.test(token)) {
      const opening = token.match(/<A\b[^>]*>/i)?.[0] || "";
      const title = decodeHtml(token.replace(/^<DT>\s*<A\b[^>]*>/i, "").replace(/<\/A>$/i, ""));
      const rawDate = attr(opening, "ADD_DATE");
      const seconds = Number(rawDate);
      entries.push({
        url: attr(opening, "HREF"),
        title,
        labels: folders.filter(Boolean),
        savedAt: Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null
      });
    }
  }
  return entries;
}

function canonicalLabels(labels, existingLabels) {
  const result = [];
  for (const raw of labels || []) {
    const cleaned = String(raw || "").trim();
    if (!cleaned) continue;
    const canonical = existingLabels.find((label) => label.toLowerCase() === cleaned.toLowerCase()) || cleaned;
    if (!result.some((label) => label.toLowerCase() === canonical.toLowerCase())) result.push(canonical);
    if (!existingLabels.some((label) => label.toLowerCase() === canonical.toLowerCase())) existingLabels.push(canonical);
  }
  return result;
}

export function inspectImport(content, fileName, existingBookmarks = []) {
  const trimmed = String(content || "").trim();
  if (!trimmed) throw new Error("The selected file is empty.");
  if (fileName?.toLowerCase().endsWith(".json") || trimmed.startsWith("{")) {
    const backup = JSON.parse(trimmed);
    if (backup.format !== "keepsake-library-backup" || !Array.isArray(backup.bookmarks)) throw new Error("This is not a Keepsake library backup.");
    return {
      kind: "backup",
      total: backup.bookmarks.length,
      newCount: backup.bookmarks.length,
      duplicateCount: 0,
      invalidCount: 0,
      dateCount: backup.bookmarks.filter((bookmark) => bookmark.savedAt).length,
      labels: [...new Set(backup.bookmarks.flatMap((bookmark) => bookmark.labels || []))].sort((a, b) => a.localeCompare(b)),
      replacesLibrary: true
    };
  }
  const entries = parseBrowserBookmarks(trimmed);
  if (!entries.length) throw new Error("No browser bookmarks were found in this file.");
  const existingKeys = new Set(existingBookmarks.map((bookmark) => bookmark.normalizedUrl || normalizeUrl(bookmark.url)));
  const seen = new Set();
  let newCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;
  let dateCount = 0;
  const labels = new Set();
  for (const entry of entries) {
    let key;
    try { key = normalizeUrl(entry.url); } catch { invalidCount += 1; continue; }
    if (existingKeys.has(key) || seen.has(key)) duplicateCount += 1;
    else {
      seen.add(key);
      newCount += 1;
      if (entry.savedAt) dateCount += 1;
      entry.labels.forEach((label) => labels.add(label));
    }
  }
  return { kind: "browser", total: entries.length, newCount, duplicateCount, invalidCount, dateCount, labels: [...labels].sort((a, b) => a.localeCompare(b)), replacesLibrary: false };
}

export function applyImport(content, fileName, currentBookmarks = []) {
  const preview = inspectImport(content, fileName, currentBookmarks);
  const now = new Date().toISOString();
  if (preview.kind === "backup") {
    const backup = JSON.parse(content);
    const labels = [];
    const bookmarks = [];
    let invalidCount = 0;
    for (const raw of backup.bookmarks) {
      try {
        const url = cleanUrl(raw.url);
        bookmarks.push({
          id: raw.id || randomUUID(),
          url,
          normalizedUrl: normalizeUrl(url),
          siteName: String(raw.siteName || siteName(url)),
          title: String(raw.title || siteName(url)),
          description: String(raw.description || ""),
          favicon: String(raw.favicon || ""),
          previewImage: String(raw.previewImage || ""),
          labels: canonicalLabels(raw.labels, labels),
          noteHtml: sanitizeNoteHtml(raw.noteHtml),
          readLater: Boolean(raw.readLater),
          archived: Boolean(raw.archived),
          savedAt: raw.savedAt && !Number.isNaN(Date.parse(raw.savedAt)) ? new Date(raw.savedAt).toISOString() : now,
          updatedAt: raw.updatedAt && !Number.isNaN(Date.parse(raw.updatedAt)) ? new Date(raw.updatedAt).toISOString() : now
        });
      } catch { invalidCount += 1; }
    }
    return { bookmarks, imported: bookmarks.length, duplicates: 0, skipped: invalidCount, restored: true };
  }
  const entries = parseBrowserBookmarks(content);
  const bookmarks = structuredClone(currentBookmarks);
  const existingKeys = new Set(bookmarks.map((bookmark) => bookmark.normalizedUrl || normalizeUrl(bookmark.url)));
  const labels = [...new Set(bookmarks.flatMap((bookmark) => bookmark.labels || []))];
  let imported = 0;
  let duplicates = 0;
  let skipped = 0;
  for (const entry of entries) {
    let url;
    let key;
    try { url = cleanUrl(entry.url); key = normalizeUrl(url); } catch { skipped += 1; continue; }
    if (existingKeys.has(key)) { duplicates += 1; continue; }
    existingKeys.add(key);
    const savedAt = entry.savedAt || now;
    bookmarks.push({
      id: randomUUID(), url, normalizedUrl: key, siteName: siteName(url),
      title: entry.title || siteName(url), description: "", favicon: "", previewImage: "",
      labels: canonicalLabels(entry.labels, labels), noteHtml: "", readLater: false, archived: false,
      savedAt, updatedAt: now
    });
    imported += 1;
  }
  return { bookmarks, imported, duplicates, skipped, restored: false };
}

export function makeBrowserExport(bookmarks) {
  const active = bookmarks.filter((bookmark) => !bookmark.archived);
  const archived = bookmarks.filter((bookmark) => bookmark.archived);
  const renderLink = (bookmark) => {
    const seconds = Math.floor(new Date(bookmark.savedAt).getTime() / 1000);
    const tags = (bookmark.labels || []).join(",");
    return `    <DT><A HREF="${htmlEscape(bookmark.url)}" ADD_DATE="${Number.isFinite(seconds) ? seconds : ""}" TAGS="${htmlEscape(tags)}">${htmlEscape(bookmark.title)}</A>`;
  };
  const folder = (name, items) => [
    `  <DT><H3>${name}</H3>`, "  <DL><p>", ...items.map(renderLink), "  </DL><p>"
  ].join("\n");
  return [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Keepsake Bookmarks</TITLE>", "<H1>Keepsake Bookmarks</H1>", "<DL><p>",
    folder("All bookmarks", active), folder("Archive", archived), "</DL><p>", ""
  ].join("\n");
}

export function makeBackup(bookmarks) {
  return { format: "keepsake-library-backup", version: 1, exportedAt: new Date().toISOString(), bookmarks: structuredClone(bookmarks) };
}

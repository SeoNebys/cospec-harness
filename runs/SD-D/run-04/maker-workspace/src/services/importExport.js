// Netscape bookmark file import/export (FR-035/036/037).
// Import merge rule (FR-036): an address that already exists keeps the existing
// bookmark's own title/description/note/read/archive/dates; only imported tags
// it does not already have are added.

import { normalizeKey, isValidUrl } from './url.js';
import { getRawByKey, createBookmark } from '../models/bookmark.js';
import { addBookmarkTags, tagsForBookmark, listTags } from '../models/tag.js';
import { getDb } from '../db/index.js';

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function encodeEntities(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Parse a Netscape bookmark HTML file into entries. Enclosing <H3> folders map
// to tags when an anchor carries no TAGS attribute.
export function parseNetscape(html) {
  const entries = [];
  // Track folder stack via <H3> ... and <DL> nesting (best-effort).
  const folderStack = [];
  const tokenRe = /<(\/?)(dl|h3|a)\b([^>]*)>([^<]*)/gi;
  let m;
  while ((m = tokenRe.exec(html)) !== null) {
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrs = m[3] || '';
    const inner = (m[4] || '').trim();
    if (tag === 'h3' && !closing) {
      folderStack.push(decodeEntities(inner));
    } else if (tag === 'dl' && closing) {
      folderStack.pop();
    } else if (tag === 'a' && !closing) {
      const href = attr(attrs, 'href');
      if (!href || !isValidUrl(href)) continue;
      const addDate = attr(attrs, 'add_date');
      const lastMod = attr(attrs, 'last_modified');
      const tagsAttr = attr(attrs, 'tags');
      let tags;
      if (tagsAttr) {
        tags = tagsAttr.split(',').map((t) => decodeEntities(t.trim())).filter(Boolean);
      } else {
        tags = folderStack.slice();
      }
      entries.push({
        url: href,
        title: decodeEntities(inner) || href,
        add_date: addDate,
        last_modified: lastMod,
        tags,
      });
    }
  }
  return entries;
}

function attr(attrs, name) {
  const re = new RegExp(name + '=["\']([^"\']*)["\']', 'i');
  const m = attrs.match(re);
  return m ? m[1] : null;
}

function toIso(epochSeconds) {
  const n = parseInt(epochSeconds, 10);
  if (Number.isNaN(n)) return null;
  return new Date(n * 1000).toISOString();
}

// Import entries applying the merge rule. Returns {added, merged, skipped}.
export function importEntries(entries, db = getDb()) {
  let added = 0;
  let merged = 0;
  let skipped = 0;
  const txn = db.transaction(() => {
    for (const e of entries) {
      if (!isValidUrl(e.url)) {
        skipped++;
        continue;
      }
      let key;
      try {
        key = normalizeKey(e.url);
      } catch {
        skipped++;
        continue;
      }
      const existing = getRawByKey(key, db);
      if (existing) {
        // Merge: keep existing fields, add only missing tags (FR-036).
        const current = tagsForBookmark(existing.id, db).map((t) => t.toLowerCase());
        const toAdd = (e.tags || []).filter(
          (t) => !current.includes(String(t).toLowerCase())
        );
        if (toAdd.length) addBookmarkTags(existing.id, toAdd, db);
        merged++;
      } else {
        const created = createBookmark(
          { url: e.url, title: e.title, tags: e.tags || [] },
          db
        );
        // Preserve imported dates when present (FR-035).
        const createdAt = toIso(e.add_date);
        const updatedAt = toIso(e.last_modified) || createdAt;
        if (createdAt) {
          db.prepare(
            'UPDATE bookmarks SET created_at = ?, updated_at = ? WHERE id = ?'
          ).run(createdAt, updatedAt || createdAt, created.id);
        }
        added++;
      }
    }
  });
  txn();
  return { added, merged, skipped };
}

// Export all bookmarks to Netscape format, retaining titles, tags, and dates.
export function exportNetscape(db = getDb()) {
  const rows = db.prepare('SELECT * FROM bookmarks ORDER BY created_at').all();
  const lines = [];
  lines.push('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
  lines.push('<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">');
  lines.push('<TITLE>Bookmarks</TITLE>');
  lines.push('<H1>Bookmarks</H1>');
  lines.push('<DL><p>');
  for (const row of rows) {
    const tags = tagsForBookmark(row.id, db);
    const addDate = Math.floor(new Date(row.created_at).getTime() / 1000);
    const lastMod = Math.floor(new Date(row.updated_at).getTime() / 1000);
    const tagsAttr = tags.length ? ` TAGS="${encodeEntities(tags.join(','))}"` : '';
    lines.push(
      `    <DT><A HREF="${encodeEntities(row.url)}" ADD_DATE="${addDate}" LAST_MODIFIED="${lastMod}"${tagsAttr}>${encodeEntities(row.title)}</A>`
    );
  }
  lines.push('</DL><p>');
  return lines.join('\n') + '\n';
}

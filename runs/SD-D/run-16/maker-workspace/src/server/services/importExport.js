// Import/export in the Netscape bookmark HTML format used by major browsers.
import * as cheerio from 'cheerio';
import { listBookmarks, getBookmarkByAddress, createBookmark } from './bookmarks.js';

function isoToUnix(iso) {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Math.floor(Date.now() / 1000) : Math.floor(t / 1000);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Generate a Netscape bookmark file from all bookmarks (normal + archived).
export function exportBookmarks() {
  const normal = listBookmarks({ view: 'normal', sort: 'oldest' }).items;
  const archived = listBookmarks({ view: 'archived', sort: 'oldest' }).items;
  const all = [...normal, ...archived];
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];
  for (const b of all) {
    const addDate = isoToUnix(b.dateAdded);
    const tags = (b.tags || []).join(',');
    const tagsAttr = tags ? ` TAGS="${escapeHtml(tags)}"` : '';
    lines.push(`    <DT><A HREF="${escapeHtml(b.address)}" ADD_DATE="${addDate}"${tagsAttr}>${escapeHtml(b.title || b.address)}</A>`);
    if (b.description) lines.push(`    <DD>${escapeHtml(b.description)}`);
  }
  lines.push('</DL><p>');
  return lines.join('\n') + '\n';
}

// Parse a Netscape bookmark file into entries.
export function parseBookmarkFile(content) {
  const text = String(content || '');
  if (!/netscape-bookmark|<dl|<a\s/i.test(text)) {
    const e = new Error('That does not look like a browser bookmark file.');
    e.status = 400;
    e.code = 'import_invalid';
    throw e;
  }
  const $ = cheerio.load(text);
  const entries = [];
  $('a').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    if (!href) return;
    const addDate = $el.attr('add_date');
    const tagsAttr = $el.attr('tags') || '';
    entries.push({
      address: href,
      title: ($el.text() || '').trim(),
      tags: tagsAttr.split(',').map((t) => t.trim()).filter(Boolean),
      dateAdded: addDate ? new Date(Number(addDate) * 1000).toISOString() : null,
    });
  });
  return entries;
}

// Import: skip existing addresses; preserve title, tags, original date-added with fallbacks.
export function importBookmarks(content) {
  const entries = parseBookmarkFile(content);
  let added = 0;
  let skipped = 0;
  for (const entry of entries) {
    let normalized;
    try {
      normalized = new URL(entry.address).href;
    } catch {
      skipped++; // unimportable address (e.g., place: / javascript:)
      continue;
    }
    if (getBookmarkByAddress(normalized)) {
      skipped++;
      continue;
    }
    try {
      createBookmark({
        address: normalized,
        title: entry.title || normalized, // fallback: address as title
        tags: entry.tags || [], // fallback: no tags
        dateAdded: entry.dateAdded || new Date().toISOString(), // fallback: import time
        skipMetadata: true,
      });
      added++;
    } catch {
      skipped++; // rejected by validation (e.g., non-http scheme)
    }
  }
  return { added, skipped };
}

// Import / export of standard (Netscape) browser-bookmarks HTML (SCN-017).
// Pure string functions so they run in Node, the browser and tests.

import { escapeHtml } from './markdown.js';
import { normalizeTag } from './tags.js';

function escAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

// Export the WHOLE collection (including archived) regardless of view.
export function toNetscapeHtml(items) {
  const out = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];
  for (const it of items) {
    let attrs = `HREF="${escAttr(it.url)}" ADD_DATE="${Math.floor((it.createdAt || Date.now()) / 1000)}"`;
    if (it.updatedAt) attrs += ` LAST_MODIFIED="${Math.floor(it.updatedAt / 1000)}"`;
    if ((it.tags || []).length) attrs += ` TAGS="${escAttr(it.tags.join(','))}"`;
    out.push(`    <DT><A ${attrs}>${escapeHtml(it.title || it.url)}</A>`);
    if (it.notes && it.notes.trim()) out.push(`    <DD>${escapeHtml(it.notes.replace(/\n/g, ' '))}`);
  }
  out.push('</DL><p>');
  return out.join('\n');
}

function attr(tagAttrs, name) {
  const re = new RegExp(name + '\\s*=\\s*"([^"]*)"', 'i');
  const m = tagAttrs.match(re);
  return m ? m[1] : null;
}

function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

// Parse anchors from a bookmarks HTML file. Returns raw records; the caller
// applies de-duplication and defaults.
export function parseNetscapeHtml(text) {
  const records = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) {
    const attrs = m[1];
    const href = attr(attrs, 'href');
    if (!href) continue;
    const title = decodeEntities(m[2].replace(/<[^>]*>/g, '').trim());
    const addRaw = attr(attrs, 'add_date');
    const addDate = addRaw && /^\d+$/.test(addRaw) ? parseInt(addRaw, 10) * 1000 : null;
    const tagsRaw = attr(attrs, 'tags') || '';
    const tags = tagsRaw ? tagsRaw.split(',').map(normalizeTag).filter(Boolean) : [];
    records.push({ url: decodeEntities(href), title, addDate, tags });
  }
  return records;
}

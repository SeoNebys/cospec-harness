// import.js — parse existing bookmarks for the import flow (SCN-016).
// Two sources: a browser's exported bookmarks file (Netscape format) and a pasted
// batch of links.

import { looksLikeUrl } from './store.js';

// Parse a Netscape bookmarks file. Returns [{url, title, folder, addedAt(ms)}].
// Folder is tracked via a stack: <H3> opens a folder, </DL> closes one. The root
// <DL> has no <H3>, so pops are floored at zero. Covers the common Chrome/Firefox/
// Safari/Edge export shape; deeply irregular files degrade to a flat import.
export function parseNetscapeBookmarks(html) {
  const entries = [];
  const folderStack = [];
  const re = /<h3[^>]*>(.*?)<\/h3>|<a\s+href="([^"]*)"([^>]*)>(.*?)<\/a>|<\/dl>/gis;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1] !== undefined) {                    // <H3>Folder</H3>
      folderStack.push(stripTags(m[1]).trim());
    } else if (m[2] !== undefined) {             // <A HREF=...>Title</A>
      const url = decodeHtml(m[2]);
      const attrs = m[3] || '';
      const title = stripTags(m[4]).trim();
      const dateMatch = /add_date="(\d+)"/i.exec(attrs);
      const addedAt = dateMatch ? Number(dateMatch[1]) * 1000 : null; // export uses seconds
      entries.push({
        url, title,
        folder: folderStack[folderStack.length - 1] || '',
        addedAt: addedAt && isFinite(addedAt) ? addedAt : null
      });
    } else {                                      // </DL>
      if (folderStack.length) folderStack.pop();
    }
  }
  return entries.filter(e => looksLikeUrl(e.url));
}

// Parse a pasted batch: one link per line (covers "forever-open tabs" copied out).
export function parseLinkList(text) {
  return String(text || '')
    .split(/[\r\n]+/)
    .map(s => s.trim())
    .filter(s => looksLikeUrl(s))
    .map(url => ({ url, title: '', folder: '', addedAt: null }));
}

// Summarize a parsed set for the preview screen.
export function summarize(entries) {
  const folders = {};
  for (const e of entries) { const f = e.folder || '(no folder)'; folders[f] = (folders[f] || 0) + 1; }
  return { count: entries.length, folders };
}

function stripTags(s) { return String(s).replace(/<[^>]*>/g, ''); }
function decodeHtml(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

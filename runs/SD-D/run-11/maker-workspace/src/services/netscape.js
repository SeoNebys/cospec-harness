// Netscape bookmark file import/export (FR-022, FR-023).
// Preserves titles, tags (TAGS attr) and dates (ADD_DATE, unix seconds).
import { parse } from 'node-html-parser';
import { isValidHttpUrl } from './normalize.js';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Serialise bookmarks to a Netscape bookmark HTML file. */
export function exportNetscape(bookmarks) {
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file. -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];
  for (const b of bookmarks) {
    const addDate = b.dateAdded
      ? Math.floor(new Date(b.dateAdded).getTime() / 1000)
      : Math.floor(Date.now() / 1000);
    const tags = (b.tags || []).join(',');
    const attrs = [
      `HREF="${escapeHtml(b.url)}"`,
      `ADD_DATE="${addDate}"`,
      tags ? `TAGS="${escapeHtml(tags)}"` : '',
    ]
      .filter(Boolean)
      .join(' ');
    lines.push(`    <DT><A ${attrs}>${escapeHtml(b.title || b.url)}</A>`);
    if (b.description) {
      lines.push(`    <DD>${escapeHtml(b.description)}`);
    }
  }
  lines.push('</DL><p>');
  return lines.join('\n') + '\n';
}

/**
 * Parse a Netscape bookmark file into bookmark descriptors.
 * Returns { bookmarks:[{url,title,tags,dateAdded,description}] }.
 * Throws if the content is not a recognisable Netscape bookmark file.
 */
export function parseNetscape(html) {
  if (typeof html !== 'string' || !/NETSCAPE-Bookmark-file|<DT>|<A\s+HREF/i.test(html)) {
    throw new Error('Not a valid Netscape bookmark file');
  }
  const root = parse(html);
  // node-html-parser discards the (unclosed) <DT>/<DD> tags, so anchors become
  // siblings and each description survives as a bare text node following its
  // anchor. Walk all nodes in document order: an <A> starts a bookmark, and the
  // next non-empty text node before the following anchor is its description.
  const bookmarks = [];
  let current = null;

  const walk = (node) => {
    for (const child of node.childNodes) {
      const tag = (child.tagName || '').toUpperCase();
      if (tag === 'A') {
        const url = child.getAttribute('href');
        if (!url || !isValidHttpUrl(url)) {
          current = null;
        } else {
          const addDate = child.getAttribute('add_date');
          let dateAdded = null;
          if (addDate && /^\d+$/.test(addDate)) {
            dateAdded = new Date(parseInt(addDate, 10) * 1000).toISOString();
          }
          const tagsAttr = child.getAttribute('tags');
          const tags = tagsAttr
            ? tagsAttr.split(',').map((t) => t.trim()).filter(Boolean)
            : [];
          current = {
            url,
            title: (child.text || '').trim() || null,
            tags,
            dateAdded,
            description: null,
          };
          bookmarks.push(current);
        }
        continue;
      }
      // Text node (no tagName): candidate description for the current bookmark.
      if (!child.tagName) {
        const text = (child.rawText || child.text || '').trim();
        if (text && current && current.description === null) {
          current.description = text;
        }
        continue;
      }
      // Descend into structural elements (DL, P, etc.).
      if (child.childNodes && child.childNodes.length) walk(child);
    }
  };
  walk(root);

  if (bookmarks.length === 0) {
    // Distinguish "no anchors at all" (invalid) handled below.
  }
  if (bookmarks.length === 0) {
    throw new Error('No valid bookmarks found in file');
  }
  return { bookmarks };
}

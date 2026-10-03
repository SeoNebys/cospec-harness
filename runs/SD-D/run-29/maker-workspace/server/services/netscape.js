// Import/export in the Netscape Bookmark File Format (the .html that browsers
// read/write). Titles, tags (TAGS attr) and saved dates (ADD_DATE, epoch seconds)
// are the standard carriers and are preserved on round-trip.
import { parse as parseHtml } from 'node-html-parser';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Parse a Netscape bookmark HTML string into entries.
// Returns { entries: [{url, title, tags: [], savedDate: ms}], skipped: n }.
export function parse(html) {
  const root = parseHtml(String(html ?? ''));
  const anchors = root.querySelectorAll('a');
  const entries = [];
  let skipped = 0;
  for (const a of anchors) {
    const href = a.getAttribute('href');
    if (!href || !/^https?:/i.test(href)) { skipped++; continue; }
    const title = (a.text || '').trim() || href;
    const addDate = a.getAttribute('add_date');
    const savedDate = addDate && /^\d+$/.test(addDate)
      ? Number(addDate) * 1000
      : Date.now();
    const tagsAttr = a.getAttribute('tags');
    const tags = tagsAttr
      ? tagsAttr.split(',').map((t) => t.trim()).filter(Boolean)
      : [];
    entries.push({ url: href, title, tags, savedDate });
  }
  return { entries, skipped };
}

// Serialize bookmarks to Netscape bookmark HTML.
// Each bookmark: { url, title, tags: [], savedDate: ms }.
export function serialize(bookmarks) {
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file. -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];
  for (const b of bookmarks) {
    const addDate = Math.floor((b.savedDate ?? Date.now()) / 1000);
    const tags = (b.tags && b.tags.length) ? ` TAGS="${escapeHtml(b.tags.join(','))}"` : '';
    lines.push(
      `    <DT><A HREF="${escapeHtml(b.url)}" ADD_DATE="${addDate}"${tags}>${escapeHtml(b.title)}</A>`,
    );
  }
  lines.push('</DL><p>');
  return lines.join('\n') + '\n';
}

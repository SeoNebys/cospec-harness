// Import/export Netscape bookmark HTML (FR-020). Preserves titles, tags
// (TAGS attribute), and dates (ADD_DATE / LAST_MODIFIED, unix seconds).
import * as cheerio from 'cheerio';

function toUnix(iso) {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? Math.floor(Date.now() / 1000) : Math.floor(ms / 1000);
}

function fromUnix(sec) {
  const n = parseInt(sec, 10);
  if (Number.isNaN(n)) return null;
  return new Date(n * 1000).toISOString();
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Parse a bookmark HTML file into an array of
// { url, title, tags:[], created_at, updated_at }.
export function parseBookmarksHtml(html) {
  if (!html || !/<a\s/i.test(html)) {
    throw new Error('File does not look like a bookmark HTML export.');
  }
  const $ = cheerio.load(html);
  const items = [];
  $('a').each((_, el) => {
    const $el = $(el);
    const url = $el.attr('href');
    if (!url) return;
    const addDate = $el.attr('add_date');
    const modDate = $el.attr('last_modified');
    const tagsAttr = $el.attr('tags') || '';
    const tags = tagsAttr.split(',').map((t) => t.trim()).filter(Boolean);
    const created = fromUnix(addDate) || new Date().toISOString();
    items.push({
      url,
      title: $el.text().trim(),
      tags,
      created_at: created,
      updated_at: fromUnix(modDate) || created,
    });
  });
  if (items.length === 0) {
    throw new Error('No bookmarks found in file.');
  }
  return items;
}

// Generate Netscape bookmark HTML from bookmark rows
// ({ url, title, tags:[], created_at, updated_at }).
export function generateBookmarksHtml(bookmarks) {
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];
  for (const b of bookmarks) {
    const attrs = [
      `HREF="${escapeHtml(b.url)}"`,
      `ADD_DATE="${toUnix(b.created_at)}"`,
      `LAST_MODIFIED="${toUnix(b.updated_at)}"`,
    ];
    if (b.tags && b.tags.length) attrs.push(`TAGS="${escapeHtml(b.tags.join(','))}"`);
    lines.push(`    <DT><A ${attrs.join(' ')}>${escapeHtml(b.title || b.url)}</A>`);
  }
  lines.push('</DL><p>');
  return lines.join('\n') + '\n';
}

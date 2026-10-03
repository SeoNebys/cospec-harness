// Netscape bookmark file import/export (FR-035–037, contracts/netscape-format.md).
import * as cheerio from 'cheerio';

export class InvalidBookmarkFileError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidBookmarkFileError';
    this.code = 'invalid_bookmark_file';
  }
}

// Parse a Netscape bookmark file into { url, title, tags, dateAdded } entries.
export function parseNetscape(content) {
  const text = String(content || '');
  const looksLikeBookmarks =
    /NETSCAPE-Bookmark-file/i.test(text) || (/<DL/i.test(text) && /<A\s+HREF/i.test(text));
  if (!looksLikeBookmarks) {
    throw new InvalidBookmarkFileError('That file is not a bookmark file.');
  }

  const $ = cheerio.load(text, { decodeEntities: true });
  const anchors = $('a[href]').toArray();
  if (anchors.length === 0) {
    throw new InvalidBookmarkFileError('No bookmarks were found in that file.');
  }

  const entries = [];
  for (const el of anchors) {
    const a = $(el);
    const url = a.attr('href');
    if (!url || !/^https?:/i.test(url)) continue;
    const title = a.text().trim() || url;
    const tagsAttr = a.attr('tags');
    const tags = tagsAttr
      ? tagsAttr
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    const addDate = a.attr('add_date');
    let dateAdded = null;
    if (addDate && /^\d+$/.test(addDate)) {
      const seconds = parseInt(addDate, 10);
      dateAdded = new Date(seconds * 1000).toISOString();
    }
    entries.push({ url, title, tags, dateAdded });
  }
  if (entries.length === 0) {
    throw new InvalidBookmarkFileError('No web bookmarks were found in that file.');
  }
  return entries;
}

// Generate a Netscape bookmark file from bookmark rows.
// Each row: { url, title, tags: string[], date_added: ISO }
export function generateNetscape(rows) {
  const lines = [];
  lines.push('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
  lines.push('<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">');
  lines.push('<TITLE>Bookmarks</TITLE>');
  lines.push('<H1>Bookmarks</H1>');
  lines.push('<DL><p>');
  for (const r of rows) {
    const secs = r.date_added ? Math.floor(new Date(r.date_added).getTime() / 1000) : '';
    const tags = Array.isArray(r.tags) ? r.tags.join(',') : '';
    const attrs = [`HREF="${escapeAttr(r.url)}"`];
    if (secs !== '' && !Number.isNaN(secs)) attrs.push(`ADD_DATE="${secs}"`);
    if (tags) attrs.push(`TAGS="${escapeAttr(tags)}"`);
    lines.push(`    <DT><A ${attrs.join(' ')}>${escapeText(r.title || r.url)}</A>`);
  }
  lines.push('</DL><p>');
  return lines.join('\n') + '\n';
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
function escapeText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Netscape bookmark-file import/export (FR-030/031/032). This is the format all
 * major browsers use for "Export bookmarks". Import applies the same
 * normalize + dedupe rule as manual saving; malformed input is rejected.
 */
import * as cheerio from 'cheerio';

export interface ParsedImportEntry {
  url: string;
  title: string;
  tags: string[];
}

export class MalformedImportError extends Error {}

export function parseNetscapeBookmarks(content: string): ParsedImportEntry[] {
  if (!content || !/netscape-bookmark|<dl|<a\s+href/i.test(content)) {
    throw new MalformedImportError('This does not look like a browser bookmarks file.');
  }
  const $ = cheerio.load(content);
  const anchors = $('a[href]');
  if (anchors.length === 0) {
    throw new MalformedImportError('No bookmarks were found in the file.');
  }
  const entries: ParsedImportEntry[] = [];
  anchors.each((_, el) => {
    const href = $(el).attr('href')?.trim();
    if (!href || !/^https?:/i.test(href)) return;
    const title = $(el).text().trim();
    const tagsAttr = $(el).attr('tags');
    const tags = tagsAttr ? tagsAttr.split(',').map((t) => t.trim()).filter(Boolean) : [];
    entries.push({ url: href, title, tags });
  });
  return entries;
}

export interface ExportEntry {
  url: string;
  title: string;
  tags: string[];
  created_at: string;
}

export function toNetscapeBookmarks(entries: ExportEntry[]): string {
  const items = entries
    .map((e) => {
      const ts = Math.floor(new Date(e.created_at).getTime() / 1000) || 0;
      const tags = e.tags.length ? ` TAGS="${escapeAttr(e.tags.join(','))}"` : '';
      return `        <DT><A HREF="${escapeAttr(e.url)}" ADD_DATE="${ts}"${tags}>${escapeHtml(e.title)}</A>`;
    })
    .join('\n');
  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
${items}
</DL><p>
`;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

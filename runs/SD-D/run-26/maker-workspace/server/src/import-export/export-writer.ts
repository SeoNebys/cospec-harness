import type { BookmarkRepository } from '../bookmarks/bookmark-repository.js';
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
export function writeExport(repo: BookmarkRepository) {
  const groups = [
    ['Active', repo.list({ collection: 'active', limit: 100000 }).items],
    ['Archive', repo.list({ collection: 'archive', limit: 100000 }).items]
  ] as const;
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- LARDER-EXPORT-VERSION="1" -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Larder Bookmarks</TITLE>',
    '<H1>Larder Bookmarks</H1>',
    '<DL><p>'
  ];
  for (const [name, items] of groups) {
    lines.push(`<DT><H3>${name}</H3>`, `<DL><p>`);
    for (const b of items) {
      const add = Math.floor(new Date(b.createdAt).getTime() / 1000),
        mod = Math.floor(new Date(b.updatedAt).getTime() / 1000),
        icon = repo.exportIcon(b.id);
      const meta = Buffer.from(
        JSON.stringify({
          v: 1,
          description: b.description,
          note: b.noteMarkdown,
          tags: b.tags.map((t) => t.name),
          read: b.isRead,
          archivedAt: b.archivedAt,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
          icon: icon
            ? {
                mime: icon.mimeType,
                data: icon.bytes.toString('base64'),
                width: icon.width,
                height: icon.height
              }
            : null
        })
      ).toString('base64url');
      lines.push(
        `<DT><A HREF="${esc(b.url)}" ADD_DATE="${add}" LAST_MODIFIED="${mod}" TAGS="${esc(b.tags.map((t) => t.name).join(','))}" DATA-BOOKMARK-MANAGER-META="${meta}">${esc(b.displayLabel)}</A>`
      );
    }
    lines.push('</DL><p>');
  }
  lines.push('</DL><p>');
  return lines.join('\n');
}

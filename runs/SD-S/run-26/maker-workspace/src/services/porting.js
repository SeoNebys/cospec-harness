// Import/export the standard Netscape bookmark HTML format (research.md #7).

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Parse a Netscape bookmark file into { address, title, tags[] } entries.
// Token/line-based to tolerate the format's unclosed tags. Folder <H3> names and
// any TAGS="" attribute both map to tags (FR-020).
export function parseNetscape(html) {
  const entries = [];
  const folderStack = [];
  let pendingFolder = null;

  // Match, in document order: <H3>…</H3>, <A …>…</A>, <DL, or </DL>.
  const token = /<h3[^>]*>([\s\S]*?)<\/h3>|<a\s+([^>]*)>([\s\S]*?)<\/a>|(<dl)|(<\/dl>)/gi;
  let m;
  while ((m = token.exec(html || '')) !== null) {
    if (m[1] !== undefined) {
      // Folder heading; applies once its <DL> opens.
      pendingFolder = decodeEntities(m[1].replace(/<[^>]*>/g, '').trim());
    } else if (m[2] !== undefined) {
      // Anchor.
      const attrs = m[2];
      const hrefMatch = /href\s*=\s*"([^"]*)"/i.exec(attrs);
      if (hrefMatch) {
        const tagsMatch = /tags\s*=\s*"([^"]*)"/i.exec(attrs);
        const attrTags = tagsMatch
          ? tagsMatch[1].split(',').map((t) => decodeEntities(t.trim())).filter(Boolean)
          : [];
        const folders = folderStack.filter(Boolean);
        entries.push({
          address: decodeEntities(hrefMatch[1].trim()),
          title: decodeEntities(m[3].replace(/<[^>]*>/g, '').trim()),
          tags: [...new Set([...folders, ...attrTags])],
        });
      }
    } else if (m[4] !== undefined) {
      // <DL> opens a folder level; adopt the most recent heading if any.
      folderStack.push(pendingFolder);
      pendingFolder = null;
    } else if (m[5] !== undefined) {
      // </DL> closes the current level.
      folderStack.pop();
    }
  }

  return entries;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Generate a Netscape bookmark HTML document from bookmark objects.
// Each bookmark's tags are emitted as TAGS="a,b" (browser-compatible) so that a
// round-trip preserves them (FR-021/SC-008).
export function generateNetscape(bookmarks) {
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];
  for (const b of bookmarks) {
    const added = Math.floor(new Date(b.createdAt || Date.now()).getTime() / 1000);
    const tagsAttr = b.tags && b.tags.length ? ` TAGS="${escapeHtml(b.tags.join(','))}"` : '';
    lines.push(
      `    <DT><A HREF="${escapeHtml(b.address)}" ADD_DATE="${added}"${tagsAttr}>${escapeHtml(
        b.title || b.address
      )}</A>`
    );
  }
  lines.push('</DL><p>');
  return lines.join('\n') + '\n';
}

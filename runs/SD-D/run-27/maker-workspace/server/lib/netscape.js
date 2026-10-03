// Netscape bookmark HTML import/export (spec FR-026/FR-027, research §8).
// Preserves title, tags (TAGS attribute + enclosing folder H3 names), and ADD_DATE.
//
// Netscape bookmark files have a very regular, well-known structure but are NOT
// valid XML/HTML (unclosed <DT>/<p>), so DOM parsers mangle the folder nesting.
// A token scan over the file in document order is the reliable approach: <H3>
// opens a folder that the following <DL> scopes and </DL> closes.

function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function getAttr(attrStr, name) {
  const re = new RegExp(name + '\\s*=\\s*"([^"]*)"', 'i');
  const m = attrStr.match(re);
  return m ? m[1] : null;
}

// Parse a Netscape bookmark file into a flat list of entries.
// Returns [{ url, title, tags: string[], addDate: number|null }]
export function parseNetscape(html) {
  const entries = [];
  const folderStack = [];
  // pending folder name captured from an <H3> awaiting its opening <DL>
  const pendingFolders = [];

  const token = /<h3[^>]*>([\s\S]*?)<\/h3>|<dl\b[^>]*>|<\/dl>|<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = token.exec(html)) !== null) {
    if (m[0].toLowerCase().startsWith('<h3')) {
      pendingFolders.push(decodeEntities(m[1].trim()));
    } else if (/^<dl/i.test(m[0])) {
      // Opening a folder scope; attach the most recent pending H3 name if any.
      folderStack.push(pendingFolders.length ? pendingFolders.pop() : null);
    } else if (/^<\/dl>/i.test(m[0])) {
      folderStack.pop();
    } else {
      // anchor
      const attrs = m[2] || '';
      const url = getAttr(attrs, 'href');
      if (!url) continue;
      const title = decodeEntities((m[3] || '').replace(/<[^>]*>/g, '').trim()) || url;
      const addDateAttr = getAttr(attrs, 'add_date');
      const addDate = addDateAttr ? parseInt(addDateAttr, 10) : null;
      const tagsAttr = getAttr(attrs, 'tags');
      const tags = new Set(folderStack.filter(Boolean));
      if (tagsAttr) {
        decodeEntities(tagsAttr).split(',').map(t => t.trim()).filter(Boolean).forEach(t => tags.add(t));
      }
      entries.push({
        url: decodeEntities(url),
        title,
        tags: [...tags],
        addDate: Number.isFinite(addDate) ? addDate : null
      });
    }
  }
  return entries;
}

// Serialize bookmarks to a Netscape bookmark HTML file.
// bookmarks: [{ url, title, tags: string[], created_at: ms }]
export function serializeNetscape(bookmarks) {
  const lines = [];
  lines.push('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
  lines.push('<!-- This is an automatically generated file. -->');
  lines.push('<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">');
  lines.push('<TITLE>Bookmarks</TITLE>');
  lines.push('<H1>Bookmarks</H1>');
  lines.push('<DL><p>');
  for (const b of bookmarks) {
    const addDate = b.created_at ? Math.floor(b.created_at / 1000) : Math.floor(Date.now() / 1000);
    const tags = (b.tags && b.tags.length) ? ` TAGS="${escapeAttr(b.tags.join(','))}"` : '';
    lines.push(
      `    <DT><A HREF="${escapeAttr(b.url)}" ADD_DATE="${addDate}"${tags}>${escapeText(b.title || b.url)}</A>`
    );
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

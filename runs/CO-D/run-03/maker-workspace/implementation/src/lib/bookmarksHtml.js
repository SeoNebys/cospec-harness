'use strict';
// Import/export of the standard Netscape bookmarks HTML format (SCN-015).
// Export keeps title, tags, and original save date via standard TAGS and
// ADD_DATE attributes, plus compatible extra attributes (NOTE, STATUS,
// ARCHIVED) that other apps ignore but this app restores on re-import.

function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
function encodeEntities(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function attr(tag, name) {
  const re = new RegExp(name + '\\s*=\\s*"([^"]*)"', 'i');
  const m = tag.match(re);
  return m ? decodeEntities(m[1]) : null;
}

// Parse a bookmarks HTML file into records. Folder <H3> names become tags
// (folderTags=true). Returns { ok, records } — ok=false when the file has no
// recognizable bookmark structure.
function parseBookmarksHtml(html, { folderTags = true } = {}) {
  const text = String(html || '');
  const hasStructure = /<A\s[^>]*HREF/i.test(text);
  if (!hasStructure) return { ok: false, records: [] };

  const records = [];
  const folderStack = [];
  // Tokenize the relevant tags in document order.
  const re = /<H3[^>]*>(.*?)<\/H3>|<\/DL>|<A\s+([^>]*)>(.*?)<\/A>/gis;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[1] !== undefined && m[0].toUpperCase().startsWith('<H3')) {
      folderStack.push(decodeEntities(m[1].replace(/<[^>]+>/g, '').trim()));
    } else if (/^<\/DL>/i.test(m[0])) {
      folderStack.pop();
    } else if (m[2] !== undefined) {
      const tagStr = '<A ' + m[2] + '>';
      const href = attr(tagStr, 'HREF');
      if (!href) continue;
      const title = decodeEntities(m[3].replace(/<[^>]+>/g, '')).trim();
      const addRaw = attr(tagStr, 'ADD_DATE');
      const addDate = addRaw && /^\d+$/.test(addRaw) ? Number(addRaw) * 1000 : null;
      const tagsAttr = attr(tagStr, 'TAGS');
      let tags = tagsAttr ? tagsAttr.split(',').map(t => t.trim()).filter(Boolean) : [];
      if (folderTags) {
        for (const f of folderStack) {
          const norm = f.toLowerCase().replace(/\s+/g, '-');
          if (norm && !tags.includes(norm)) tags.push(norm);
        }
      }
      const note = attr(tagStr, 'NOTE');
      const status = attr(tagStr, 'STATUS');
      const archived = attr(tagStr, 'ARCHIVED');
      records.push({
        url: href,
        title: title || href,
        addDate,
        tags,
        note: note || '',
        status: status === 'finished' ? 'finished' : status === 'toread' ? 'toread' : null,
        archived: archived === '1' || archived === 'true'
      });
    }
  }
  return { ok: true, records };
}

// Build a Netscape bookmarks HTML file from bookmark records.
function buildBookmarksHtml(bookmarks) {
  const lines = [];
  lines.push('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
  lines.push('<!-- This is an automatically generated file. It will be read and overwritten. -->');
  lines.push('<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">');
  lines.push('<TITLE>Bookmarks</TITLE>');
  lines.push('<H1>Bookmarks</H1>');
  lines.push('<DL><p>');
  for (const b of bookmarks) {
    const add = b.created_at ? Math.floor(Number(b.created_at) / 1000) : Math.floor(Date.now() / 1000);
    const tags = (b.tags || []).join(',');
    let a = `    <DT><A HREF="${encodeEntities(b.url)}" ADD_DATE="${add}"`;
    if (tags) a += ` TAGS="${encodeEntities(tags)}"`;
    if (b.note) a += ` NOTE="${encodeEntities(b.note)}"`;
    if (b.status) a += ` STATUS="${encodeEntities(b.status)}"`;
    if (b.archived) a += ` ARCHIVED="1"`;
    a += `>${encodeEntities(b.title || b.url)}</A>`;
    lines.push(a);
  }
  lines.push('</DL><p>');
  return lines.join('\n') + '\n';
}

module.exports = { parseBookmarksHtml, buildBookmarksHtml, encodeEntities, decodeEntities };

import { cleanLabels, normalizeUrl, parseHttpUrl } from './domain.js';

function decode(value = '') { return value.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').trim(); }

export function parseBrowserBookmarks(content) {
  if (!/NETSCAPE-Bookmark-file-1/i.test(content) || !/<A\s/i.test(content)) throw new Error('That file is not a browser bookmark export.');
  const lines = content.split(/\r?\n/);
  const folders = [];
  const bookmarks = [];
  for (const line of lines) {
    const folder = line.match(/<H3[^>]*>([\s\S]*?)<\/H3>/i);
    if (folder) { folders.push(decode(folder[1])); continue; }
    if (/<\/DL>/i.test(line) && folders.length) folders.pop();
    const match = line.match(/<A\s+([^>]*)>([\s\S]*?)<\/A>/i);
    if (!match) continue;
    const href = match[1].match(/HREF=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try { parseHttpUrl(decode(href)); } catch { continue; }
    const addDate = match[1].match(/ADD_DATE=["']?(\d+)["']?/i)?.[1];
    const timestamp = addDate ? new Date(Number(addDate) * 1000) : null;
    bookmarks.push({ url: decode(href), title: decode(match[2]) || new URL(decode(href)).hostname, labels: cleanLabels(folders), createdAt: timestamp && !Number.isNaN(timestamp.valueOf()) ? timestamp.toISOString() : null, dateKnown: Boolean(timestamp && !Number.isNaN(timestamp.valueOf())) });
  }
  if (!bookmarks.length) throw new Error('No usable bookmarks were found in that file.');
  return bookmarks;
}

export function previewImport(incoming, existing) {
  const byUrl = new Map(existing.map(bookmark => [bookmark.normalizedUrl, bookmark]));
  const folders = new Set();
  let duplicates = 0;
  let dated = 0;
  for (const bookmark of incoming) {
    bookmark.labels.forEach(label => folders.add(label));
    if (bookmark.dateKnown) dated++;
    if (byUrl.has(normalizeUrl(bookmark.url))) duplicates++;
  }
  return { total: incoming.length, newCount: incoming.length - duplicates, duplicates, dated, folders: [...folders].sort() };
}

export function browserHtml(bookmarks) {
  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const groups = new Map([['Bookmarks', []]]);
  for (const bookmark of bookmarks.filter(item => !item.putAway)) {
    const label = bookmark.labels[0] || 'Bookmarks';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(bookmark);
  }
  const sections = [...groups.entries()].filter(([, items]) => items.length).map(([label, items]) => `<DT><H3>${escape(label)}</H3>\n<DL><p>\n${items.map(item => `<DT><A HREF="${escape(item.url)}"${item.dateKnown ? ` ADD_DATE="${Math.floor(new Date(item.createdAt).valueOf() / 1000)}"` : ''}>${escape(item.title)}</A>`).join('\n')}\n</DL><p>`).join('\n');
  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Kept bookmarks</TITLE>\n<H1>Kept bookmarks</H1>\n<DL><p>\n${sections}\n</DL><p>\n`;
}

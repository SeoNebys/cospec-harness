'use strict';

const cheerio = require('cheerio');
const { domainOf } = require('./metadata');

// ---- Export ---------------------------------------------------------------

function toJSON(rows) {
  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      version: 1,
      bookmarks: rows.map((r) => ({
        url: r.url,
        title: r.title,
        description: r.description,
        notes: r.notes,
        icon: r.icon,
        preview_image: r.preview_image,
        read_later: !!r.read_later,
        archived: !!r.archived,
        tags: r.tags || [],
        created_at: r.created_at,
        updated_at: r.updated_at
      }))
    },
    null,
    2
  );
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toNetscapeHTML(rows) {
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>'
  ];
  for (const r of rows) {
    const add = Math.floor((r.created_at || Date.now()) / 1000);
    const tags = (r.tags || []).join(',');
    lines.push(
      `    <DT><A HREF="${esc(r.url)}" ADD_DATE="${add}"` +
        (tags ? ` TAGS="${esc(tags)}"` : '') +
        `>${esc(r.title || r.url)}</A>`
    );
    if (r.description) lines.push(`    <DD>${esc(r.description)}`);
  }
  lines.push('</DL><p>');
  return lines.join('\n');
}

// ---- Import ---------------------------------------------------------------

function parseJSONImport(text) {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : data.bookmarks || [];
  return arr
    .filter((b) => b && b.url)
    .map((b) => ({
      url: String(b.url),
      title: b.title || '',
      description: b.description || '',
      notes: b.notes || '',
      icon: b.icon || '',
      preview_image: b.preview_image || '',
      read_later: b.read_later ? 1 : 0,
      archived: b.archived ? 1 : 0,
      tags: Array.isArray(b.tags)
        ? b.tags.map((t) => String(t).trim()).filter(Boolean)
        : [],
      domain: domainOf(String(b.url))
    }));
}

function parseNetscapeImport(text) {
  const $ = cheerio.load(text);
  const out = [];
  $('a').each((_, el) => {
    const $el = $(el);
    const url = $el.attr('href');
    if (!url || !/^https?:/i.test(url)) return;
    const tags = ($el.attr('tags') || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    // A following <dd> holds the description in Netscape format.
    let description = '';
    const dt = $el.closest('dt');
    const dd = dt.length ? dt.nextAll('dd').first() : $();
    if (dd.length) description = dd.text().trim();
    out.push({
      url,
      title: ($el.text() || '').trim() || url,
      description,
      notes: '',
      icon: $el.attr('icon') || '',
      preview_image: '',
      read_later: 0,
      archived: 0,
      tags,
      domain: domainOf(url)
    });
  });
  return out;
}

function parseImport(text, format) {
  const trimmed = text.trimStart();
  if (format === 'json' || (!format && trimmed.startsWith('{')) || (!format && trimmed.startsWith('['))) {
    return parseJSONImport(text);
  }
  return parseNetscapeImport(text);
}

module.exports = { toJSON, toNetscapeHTML, parseImport };

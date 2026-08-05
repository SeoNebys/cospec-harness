// Readable-copy extractor (SCN-016 core). Best-effort, dependency-free, works in
// an MV3 service worker (no DOM) and is unit-testable in Node. Produces a clean,
// script-free readable version of a page + a partial flag when little could be
// captured (login/paywall/JS-heavy — labelled honestly per SCN-016).

function decode(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/gi, "'").replace(/&nbsp;/g, ' ');
}
function absolute(url, base) {
  try { return new URL(url, base).href; } catch { return url; }
}
// inner HTML of the first <tag>…</tag>, or '' if absent
function pick(html, tag) {
  const m = html.match(new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
  return m ? m[1] : '';
}

const ALLOWED = new Set(['h1', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'strong', 'b', 'em', 'i', 'figure', 'figcaption', 'img', 'a', 'br', 'hr']);

function sanitizeReader(html, base) {
  return String(html).replace(/<(\/?)([a-z0-9]+)([^>]*)>/gi, (_m, slash, tag, attrs) => {
    tag = tag.toLowerCase();
    if (!ALLOWED.has(tag)) return '';
    if (slash) return '</' + tag + '>';
    if (tag === 'img') {
      const src = (attrs.match(/\bsrc=["']([^"']+)["']/i) || [])[1];
      const alt = (attrs.match(/\balt=["']([^"']*)["']/i) || [])[1] || '';
      return src ? `<img src="${absolute(src, base)}" alt="${decode(alt)}">` : '';
    }
    if (tag === 'a') {
      const href = (attrs.match(/\bhref=["']([^"']+)["']/i) || [])[1];
      return href ? `<a href="${absolute(href, base)}" rel="noopener">` : '<a>';
    }
    return '<' + tag + '>';
  });
}

export function extractReadable(html, baseUrl) {
  html = String(html || '');
  let s = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, '');
  const tm = s.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = tm ? decode(tm[1]).replace(/\s+/g, ' ').trim() : '';

  let body = pick(s, 'article') || pick(s, 'main') || pick(s, 'body') || s;
  body = body.replace(/<(nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, '');
  const clean = sanitizeReader(body, baseUrl).replace(/(\s*<br>\s*){3,}/gi, '<br><br>').trim();

  const text = clean.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const partial = text.length < 200; // very little captured => honest "partial"
  return { title, html: clean, text, partial };
}

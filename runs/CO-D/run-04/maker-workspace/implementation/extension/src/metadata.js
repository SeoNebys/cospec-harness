// Best-effort page metadata extraction from raw HTML (SCN-001 recognise,
// SCN-004 unreadable fallback). Pure/regex-based so it works in an MV3 service
// worker (no DOMParser there) and is unit-testable in Node. Attribute order is
// handled either way (content-before-property etc.).

export function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#x0*27;|&apos;/gi, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function metaTags(html) {
  return [...String(html || '').matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
}
function contentOf(tag) {
  const c = tag.match(/content=["']([^"']*)["']/i);
  return c ? decodeEntities(c[1]) : '';
}

export function parseMetadata(html) {
  html = String(html || '');
  const metas = metaTags(html);
  const find = (re) => metas.find((t) => re.test(t));

  const og = find(/(?:name|property)=["']og:title["']/i);
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  let title = (og ? contentOf(og) : '') || (titleTag ? decodeEntities(titleTag[1]) : '');

  const descMeta =
    find(/name=["']description["']/i) || find(/(?:name|property)=["']og:description["']/i);
  let description = descMeta ? contentOf(descMeta) : '';

  title = title.replace(/\s+/g, ' ').trim();
  description = description.replace(/\s+/g, ' ').trim();

  return { title, description, ok: !!title };
}

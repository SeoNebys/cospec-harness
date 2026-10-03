'use strict';
// Build a genuinely self-contained single-file copy of a web page (SCN-013):
// external stylesheets, images and fonts are fetched and inlined as data: URIs,
// and live <script> tags are removed, so the saved copy renders as it was even
// if the original site later changes or disappears. Best-effort: any resource
// that can't be fetched (or exceeds size limits) is left as-is rather than
// failing the whole copy.

const MAX_RESOURCE = 5 * 1024 * 1024;   // per asset
const MAX_TOTAL = 40 * 1024 * 1024;     // whole snapshot budget

function absolute(url, base) {
  try { return new URL(url, base).toString(); } catch { return null; }
}
function toDataUri(contentType, buffer) {
  const ct = (contentType || 'application/octet-stream').split(';')[0].trim();
  return `data:${ct};base64,${buffer.toString('base64')}`;
}

// fetchResource(url) => { ok, contentType, buffer } | { ok:false }
function makeFetcher(timeoutMs = 12000) {
  return async function (url) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'BookmarksApp/1.0' } });
        if (!res.ok) return { ok: false };
        const len = Number(res.headers.get('content-length') || 0);
        if (len && len > MAX_RESOURCE) return { ok: false };
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > MAX_RESOURCE) return { ok: false };
        return { ok: true, contentType: res.headers.get('content-type') || '', buffer };
      } finally { clearTimeout(t); }
    } catch { return { ok: false }; }
  };
}

async function snapshot(html, baseUrl, fetchResource, opts = {}) {
  const fetchRes = fetchResource || makeFetcher(opts.timeoutMs);
  const budget = { used: 0 };
  const cache = new Map();

  async function grab(url) {
    if (!url || /^data:/i.test(url)) return null;
    const abs = absolute(url, baseUrl);
    if (!abs || !/^https?:/i.test(abs)) return null;
    if (cache.has(abs)) return cache.get(abs);
    if (budget.used >= MAX_TOTAL) return null;
    const r = await fetchRes(abs);
    let out = null;
    if (r.ok && budget.used + r.buffer.length <= MAX_TOTAL) {
      budget.used += r.buffer.length;
      out = { dataUri: toDataUri(r.contentType, r.buffer), text: () => r.buffer.toString('utf8'), contentType: r.contentType, abs };
    }
    cache.set(abs, out);
    return out;
  }

  // Inline url(...) inside a CSS string, resolving relative to the CSS's own URL.
  async function inlineCss(cssText, cssBase, depth = 0) {
    let css = cssText;
    // @import "x" / @import url(x)
    if (depth < 3) {
      const imports = [...css.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')]+)["']?\s*\)?\s*;/gi)];
      for (const m of imports) {
        const impUrl = absolute(m[1], cssBase);
        const got = impUrl ? await grab(impUrl) : null;
        let replacement = '';
        if (got && /css/i.test(got.contentType || '') || (got && /\.css($|\?)/i.test(impUrl))) {
          replacement = await inlineCss(got.text(), impUrl, depth + 1);
        }
        css = css.replace(m[0], replacement);
      }
    }
    // url(...) for fonts/images/backgrounds
    const urls = [...css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)];
    for (const m of urls) {
      const raw = m[2];
      if (/^data:/i.test(raw)) continue;
      const got = await grab(absolute(raw, cssBase));
      if (got) css = css.split(m[0]).join(`url(${got.dataUri})`);
    }
    return css;
  }

  // 1) remove scripts (avoid stale live calls; keep the visual snapshot).
  let out = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/>/gi, '')
    // drop any existing <base> so nothing resolves against the live origin
    .replace(/<base\b[^>]*>/gi, '');

  // 2) inline <link rel="stylesheet" href="...">
  const links = [...out.matchAll(/<link\b[^>]*>/gi)];
  for (const m of links) {
    const tag = m[0];
    if (!/rel\s*=\s*["'][^"']*stylesheet[^"']*["']/i.test(tag)) continue;
    const href = (tag.match(/href\s*=\s*["']([^"']+)["']/i) || [])[1];
    const absHref = href ? absolute(href, baseUrl) : null;
    const got = absHref ? await grab(absHref) : null;
    if (got) {
      const inlined = await inlineCss(got.text(), absHref);
      out = out.replace(tag, `<style data-inlined="1">\n${inlined}\n</style>`);
    }
  }

  // 3) inline <style> blocks' url()
  const styleBlocks = [...out.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
  for (const m of styleBlocks) {
    if (/data-inlined/i.test(m[0])) continue; // already processed
    const inlined = await inlineCss(m[1], baseUrl);
    if (inlined !== m[1]) out = out.replace(m[0], m[0].replace(m[1], inlined));
  }

  // 4) inline <img src> (and strip srcset so nothing loads from the live site)
  const imgs = [...out.matchAll(/<img\b[^>]*>/gi)];
  for (const m of imgs) {
    let tag = m[0];
    const src = (tag.match(/\ssrc\s*=\s*["']([^"']+)["']/i) || [])[1];
    const got = src ? await grab(absolute(src, baseUrl)) : null;
    let newTag = tag.replace(/\ssrcset\s*=\s*["'][^"']*["']/i, '');
    if (got) newTag = newTag.replace(/(\ssrc\s*=\s*["'])[^"']+(["'])/i, `$1${got.dataUri}$2`);
    if (newTag !== tag) out = out.replace(tag, newTag);
  }

  // 5) inline style="...url()..." attributes
  const styled = [...out.matchAll(/style\s*=\s*"([^"]*url\([^"]*)"/gi)];
  for (const m of styled) {
    const inlined = await inlineCss(m[1], baseUrl);
    if (inlined !== m[1]) out = out.replace(m[0], m[0].replace(m[1], inlined));
  }

  return out;
}

module.exports = { snapshot, makeFetcher, toDataUri, absolute };

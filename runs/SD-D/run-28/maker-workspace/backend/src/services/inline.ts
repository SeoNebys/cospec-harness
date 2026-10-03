import * as cheerio from 'cheerio';

/**
 * Turn a fetched HTML page into a SELF-CONTAINED snapshot (FR-022): stylesheets
 * (and the assets they reference), images, and icons are fetched and embedded so
 * the stored copy renders independently of the live site — even if the original
 * changes, disappears, or is unreachable. Scripts and live-linked resources are
 * removed so nothing depends on the network at view time.
 *
 * Best-effort and bounded: per-resource timeout, size cap, and a total budget.
 * A resource that cannot be fetched is simply dropped rather than failing the
 * whole snapshot.
 */

const RESOURCE_TIMEOUT_MS = 8000;
const MAX_RESOURCE_BYTES = 4 * 1024 * 1024; // 4 MB per asset
const TOTAL_BUDGET_BYTES = 24 * 1024 * 1024; // ~24 MB per snapshot
const UA = 'BookmarkManager/1.0 (+local single-user app)';

interface Resource {
  contentType: string;
  bytes: Buffer;
}

type Fetcher = (url: string) => Promise<Resource | null>;

async function defaultFetchResource(url: string): Promise<Resource | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESOURCE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: '*/*' },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_RESOURCE_BYTES) return null;
    const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    return { contentType, bytes: buf };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function toDataUri(res: Resource, fallbackType: string): string {
  const type = res.contentType || fallbackType;
  return `data:${type};base64,${res.bytes.toString('base64')}`;
}

function guessTypeFromUrl(url: string): string {
  const ext = url.split(/[?#]/)[0].split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
    css: 'text/css',
  };
  return map[ext] ?? 'application/octet-stream';
}

function isInlineable(href: string | undefined): href is string {
  if (!href) return false;
  const h = href.trim();
  if (!h) return false;
  if (h.startsWith('data:')) return false;
  if (h.startsWith('#')) return false;
  if (h.startsWith('javascript:')) return false;
  if (h.startsWith('mailto:') || h.startsWith('tel:')) return false;
  return true;
}

export async function inlineResources(
  html: string,
  baseUrl: string,
  fetchResource: Fetcher = defaultFetchResource,
): Promise<string> {
  const $ = cheerio.load(html);
  const cache = new Map<string, Resource | null>();
  let spent = 0;

  const resolve = (href: string, base: string): string | null => {
    try {
      return new URL(href, base).toString();
    } catch {
      return null;
    }
  };

  const get = async (url: string): Promise<Resource | null> => {
    if (cache.has(url)) return cache.get(url) ?? null;
    if (spent >= TOTAL_BUDGET_BYTES) {
      cache.set(url, null);
      return null;
    }
    const r = await fetchResource(url);
    if (r) spent += r.bytes.byteLength;
    cache.set(url, r);
    return r;
  };

  // Inline url(...) references (and @import) inside CSS text.
  const inlineCss = async (css: string, cssBase: string, depth: number): Promise<string> => {
    let out = css;

    // @import "..." / @import url(...)
    if (depth < 3) {
      const imports = [...out.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')]+)["']?\s*\)?\s*;/gi)];
      for (const m of imports) {
        const ref = m[1];
        if (!isInlineable(ref)) continue;
        const abs = resolve(ref, cssBase);
        if (!abs) continue;
        const res = await get(abs);
        if (res) {
          const importedCss = await inlineCss(res.bytes.toString('utf8'), abs, depth + 1);
          out = out.replace(m[0], importedCss);
        } else {
          out = out.replace(m[0], '');
        }
      }
    }

    // url(...) references (images, fonts).
    const urls = [...out.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi)];
    for (const m of urls) {
      const ref = m[2];
      if (!isInlineable(ref)) continue;
      const abs = resolve(ref, cssBase);
      if (!abs) continue;
      const res = await get(abs);
      if (res) {
        out = out.replace(m[0], `url(${toDataUri(res, guessTypeFromUrl(abs))})`);
      }
    }
    return out;
  };

  // Remove things that would reach out to the network at view time.
  $('script').remove();
  $('base').remove();
  $('link[rel~="preload"], link[rel~="prefetch"], link[rel~="dns-prefetch"], link[rel~="modulepreload"]').remove();

  // Stylesheets → inline <style> with their assets embedded.
  for (const el of $('link[rel~="stylesheet"]').toArray()) {
    const href = $(el).attr('href');
    if (!isInlineable(href)) {
      $(el).remove();
      continue;
    }
    const abs = resolve(href, baseUrl);
    const res = abs ? await get(abs) : null;
    if (res) {
      const cssText = await inlineCss(res.bytes.toString('utf8'), abs!, 0);
      $(el).replaceWith(`<style>${cssText}</style>`);
    } else {
      $(el).remove();
    }
  }

  // <style> blocks may also contain url()/@import → inline them too.
  for (const el of $('style').toArray()) {
    const cssText = $(el).html() ?? '';
    if (cssText.includes('url(') || cssText.includes('@import')) {
      $(el).text(await inlineCss(cssText, baseUrl, 0));
    }
  }

  // Images → data URIs (drop srcset which would re-fetch remote variants).
  for (const el of $('img').toArray()) {
    $(el).removeAttr('srcset');
    $(el).removeAttr('loading');
    const src = $(el).attr('src');
    if (!isInlineable(src)) continue;
    const abs = resolve(src!, baseUrl);
    const res = abs ? await get(abs) : null;
    if (res) $(el).attr('src', toDataUri(res, guessTypeFromUrl(abs!)));
  }
  // <source srcset> inside <picture> → drop (rely on <img> fallback).
  $('picture source').remove();

  // Favicons / touch icons → data URIs (best effort).
  for (const el of $('link[rel~="icon"], link[rel~="apple-touch-icon"]').toArray()) {
    const href = $(el).attr('href');
    if (!isInlineable(href)) continue;
    const abs = resolve(href!, baseUrl);
    const res = abs ? await get(abs) : null;
    if (res) $(el).attr('href', toDataUri(res, guessTypeFromUrl(abs!)));
    else $(el).remove();
  }

  // Record provenance for the reader.
  $('head').prepend(
    `<!-- Preserved by Bookmark Manager on ${new Date().toISOString()} from ${baseUrl} -->`,
  );

  return $.html();
}

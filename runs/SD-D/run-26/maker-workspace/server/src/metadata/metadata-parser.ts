import { decode } from 'html-entities';
import { cleanMetadataText } from '@shared/normalize.js';
export type ParsedMetadata = {
  title: string | null;
  description: string | null;
  icons: { href: string; rel: string; sizes: string }[];
};
function attrs(source: string) {
  const out: Record<string, string> = {};
  for (const m of source.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))
    out[m[1]!.toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  return out;
}
export function parseMetadata(html: Buffer | string, pageUrl: string): ParsedMetadata {
  const source = (Buffer.isBuffer(html) ? html.toString('utf8') : html).slice(0, 1_500_000);
  const meta = new Map<string, string>();
  for (const match of source.matchAll(/<meta\b([^>]*)>/gi)) {
    const a = attrs(match[1]!);
    const key = (a.property ?? a.name ?? '').toLowerCase();
    if (key && !meta.has(key) && a.content) meta.set(key, a.content);
  }
  const titleMatch = source.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  const title = cleanMetadataText(
    meta.get('og:title') ??
      meta.get('twitter:title') ??
      (titleMatch ? decode(titleMatch[1]!.replace(/<[^>]*>/g, '')) : undefined),
    300
  );
  const description = cleanMetadataText(
    meta.get('og:description') ?? meta.get('twitter:description') ?? meta.get('description'),
    2000
  );
  const baseMatch = source.match(/<base\b([^>]*)>/i),
    baseAttr = baseMatch ? attrs(baseMatch[1]!).href : undefined;
  let base = pageUrl;
  try {
    if (baseAttr) base = new URL(baseAttr, pageUrl).href;
  } catch {}
  const icons: { href: string; rel: string; sizes: string }[] = [];
  for (const match of source.matchAll(/<link\b([^>]*)>/gi)) {
    const a = attrs(match[1]!);
    const rel = (a.rel ?? '').toLowerCase();
    if (a.href && /(?:^|\s)(?:icon|shortcut icon|apple-touch-icon)(?:\s|$)/.test(rel)) {
      try {
        icons.push({ href: new URL(a.href, base).href, rel, sizes: a.sizes ?? '' });
      } catch {}
    }
  }
  icons.sort((a, b) => score(b) - score(a));
  return { title, description, icons };
}
const score = (i: { rel: string; sizes: string }) =>
  (i.rel.includes('apple') ? 20 : 0) +
  Math.max(...[...i.sizes.matchAll(/(\d+)x(\d+)/g)].map((m) => Number(m[1])), 0);

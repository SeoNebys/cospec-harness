import { load } from 'cheerio';
import { fallbackTitle } from './url-policy.js';

export type ExtractedMetadata = { title: string; titleSource: string; description: string | null; descriptionSource: string | null; iconCandidates: string[] };

const clean = (value: string | undefined, max: number) => {
  const result = value?.normalize('NFKC').replace(/[\s\p{Cc}]+/gu, ' ').trim();
  return result ? result.slice(0, max) : null;
};

export function extractMetadata(html: string, finalUrl: URL): ExtractedMetadata {
  const $ = load(html, { xmlMode: false });
  const titleChoices: Array<[string | undefined, string]> = [
    [$('meta[property="og:title"]').first().attr('content'), 'og:title'],
    [$('title').first().text(), 'title'],
    [$('meta[name="twitter:title"]').first().attr('content'), 'twitter:title'],
  ];
  const titleEntry = titleChoices.map(([v, s]) => [clean(v, 300), s] as const).find(([v]) => v);
  const descChoices: Array<[string | undefined, string]> = [
    [$('meta[property="og:description"]').first().attr('content'), 'og:description'],
    [$('meta[name="description"]').first().attr('content'), 'description'],
    [$('meta[name="twitter:description"]').first().attr('content'), 'twitter:description'],
  ];
  const descEntry = descChoices.map(([v, s]) => [clean(v, 2_000), s] as const).find(([v]) => v);
  const icons: string[] = [];
  $('link[rel]').each((_index, element) => {
    const rel = ($(element).attr('rel') ?? '').toLowerCase().split(/\s+/u);
    if (rel.includes('icon') || rel.includes('apple-touch-icon')) {
      const href = $(element).attr('href');
      if (href) try { icons.push(new URL(href, finalUrl).href); } catch { /* discard malformed */ }
    }
  });
  icons.push(new URL('/favicon.ico', finalUrl).href);
  return {
    title: titleEntry?.[0] ?? fallbackTitle(finalUrl.href),
    titleSource: titleEntry?.[1] ?? 'fallback',
    description: descEntry?.[0] ?? null,
    descriptionSource: descEntry?.[1] ?? null,
    iconCandidates: [...new Set(icons)],
  };
}

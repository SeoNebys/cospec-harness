import * as cheerio from 'cheerio';

export interface ParsedMetadata {
  title: string | null;
  description: string | null;
}

function clean(value: string | undefined, maximum: number): string | null {
  if (value && /<\s*\/?\s*(script|style|iframe|object)\b/i.test(value)) return null;
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, maximum) : null;
}

export function parseMetadata(html: string): ParsedMetadata {
  const $ = cheerio.load(html);
  const title = clean(
    $('meta[property="og:title"]').first().attr('content')
      ?? $('meta[name="twitter:title"]').first().attr('content')
      ?? $('title').first().text(),
    300,
  );
  const description = clean(
    $('meta[property="og:description"]').first().attr('content')
      ?? $('meta[name="twitter:description"]').first().attr('content')
      ?? $('meta[name="description"]').first().attr('content'),
    1000,
  );
  return { title, description };
}

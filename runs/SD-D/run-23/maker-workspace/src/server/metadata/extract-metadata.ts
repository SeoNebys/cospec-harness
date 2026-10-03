import { load } from 'cheerio';

export interface ExtractedMetadata {
  title: string;
  description: string | null;
  siteIconUrl: string | null;
  previewImageUrl: string | null;
}

function clean(value: string | undefined, max: number): string | null {
  if (!value) return null;
  const result = value.normalize('NFKC').replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim();
  return result ? [...result].slice(0, max).join('') : null;
}

function httpUrl(value: string | undefined, base: URL): string | null {
  if (!value) return null;
  try {
    const result = new URL(value, base);
    return ['http:', 'https:'].includes(result.protocol) && !result.username && !result.password ? result.href : null;
  } catch { return null; }
}

export function extractMetadata(html: string, responseUrl: string): ExtractedMetadata {
  const $ = load(html, { xmlMode: false });
  const response = new URL(responseUrl);
  const base = httpUrl($('base[href]').first().attr('href'), response);
  const assetBase = base ? new URL(base) : response;
  const meta = (property: string) => $(`meta[property="${property}"]`).first().attr('content');
  const named = (name: string) => $(`meta[name="${name}"]`).first().attr('content');
  const title = clean(meta('og:title'), 200) || clean($('title').first().text(), 200) || response.hostname;
  const description = clean(meta('og:description'), 2000) || clean(named('description'), 2000);
  const image = httpUrl(meta('og:image:secure_url'), assetBase) || httpUrl(meta('og:image'), assetBase) || httpUrl(named('twitter:image'), assetBase);
  let icon: string | null = null;
  $('link[rel]').each((_index, element) => {
    if (icon) return;
    const rel = ($(element).attr('rel') || '').toLowerCase().split(/\s+/);
    if (rel.includes('icon')) icon = httpUrl($(element).attr('href'), assetBase);
  });
  icon ||= new URL('/favicon.ico', response).href;
  return { title, description, siteIconUrl: icon, previewImageUrl: image };
}

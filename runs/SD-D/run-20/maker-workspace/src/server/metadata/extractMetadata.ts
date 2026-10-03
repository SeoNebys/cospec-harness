import { load } from 'cheerio';

export interface ExtractedMetadata {
  title: string | null;
  description: string | null;
  iconUrl: string | null;
  previewImageUrl: string | null;
}

export function decodeHtml(bytes: Buffer, contentType = ''): string {
  const headerCharset = /charset\s*=\s*["']?([^\s;"']+)/i.exec(contentType)?.[1];
  const prefix = bytes.subarray(0, 2048).toString('ascii');
  const documentCharset = /<meta[^>]+charset\s*=\s*["']?([^\s;"'>]+)/i.exec(prefix)?.[1];
  try {
    return new TextDecoder(headerCharset ?? documentCharset ?? 'utf-8').decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

const clean = (value: string | undefined, maximum: number): string | null => {
  const text = value?.replace(/\s+/g, ' ').trim();
  return text ? [...text].slice(0, maximum).join('') : null;
};

export function extractMetadata(html: string, pageUrl: string): ExtractedMetadata {
  const $ = load(html, { xmlMode: false });
  $('script,style,noscript,template').remove();
  const meta = (key: string): string | undefined =>
    $(`meta[property="${key}"],meta[name="${key}"]`).first().attr('content');
  const absolute = (value: string | undefined): string | null => {
    if (!value) return null;
    try {
      const url = new URL(value, pageUrl);
      return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
    } catch {
      return null;
    }
  };
  return {
    title: clean(meta('og:title') ?? meta('twitter:title') ?? $('title').first().text(), 200),
    description: clean(meta('og:description') ?? meta('twitter:description') ?? meta('description'), 500),
    iconUrl: absolute($('link[rel~="icon"]').last().attr('href') ?? '/favicon.ico'),
    previewImageUrl: absolute(meta('og:image') ?? meta('twitter:image')),
  };
}

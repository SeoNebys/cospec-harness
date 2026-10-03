import { load } from 'cheerio';

function clean(value: string | undefined | null, max: number): string | null {
  const text = value?.replace(/[\u0000-\u001f\u007f]/gu, ' ').replace(/\s+/gu, ' ').trim() ?? '';
  return text ? [...text].slice(0, max).join('') : null;
}
export type ExtractedMetadata = { title: string; titleSource: 'html-title'|'open-graph'|'twitter'|'fallback'; description: string|null; descriptionSource: 'meta-description'|'open-graph'|'twitter'|null; iconUrl:string|null };
export function extractMetadata(html: Buffer|string, pageUrl: string, contentType = 'text/html; charset=utf-8'): ExtractedMetadata {
  const charset = /charset=([^;]+)/i.exec(contentType)?.[1]?.trim().replace(/["']/g,'') ?? 'utf-8';
  let decoded: string;
  try { decoded = typeof html === 'string' ? html : new TextDecoder(charset).decode(html); } catch { decoded = typeof html === 'string' ? html : new TextDecoder('utf-8').decode(html); }
  const $ = load(decoded);
  const htmlTitle = clean($('title').first().text(), 512);
  const ogTitle = clean($('meta[property="og:title"]').first().attr('content'), 512);
  const twitterTitle = clean($('meta[name="twitter:title"]').first().attr('content'), 512);
  const title = htmlTitle ?? ogTitle ?? twitterTitle ?? new URL(pageUrl).hostname;
  const titleSource = htmlTitle ? 'html-title' : ogTitle ? 'open-graph' : twitterTitle ? 'twitter' : 'fallback';
  const standardDescription = clean($('meta[name="description"]').first().attr('content'), 2000);
  const ogDescription = clean($('meta[property="og:description"]').first().attr('content'), 2000);
  const twitterDescription = clean($('meta[name="twitter:description"]').first().attr('content'), 2000);
  const description = standardDescription ?? ogDescription ?? twitterDescription;
  const descriptionSource = standardDescription ? 'meta-description' : ogDescription ? 'open-graph' : twitterDescription ? 'twitter' : null;
  let iconHref = $('link[rel~="icon"]').first().attr('href') ?? $('link[rel="apple-touch-icon"]').first().attr('href') ?? '/favicon.ico';
  let iconUrl: string|null = null;
  try { iconUrl = new URL(iconHref, pageUrl).toString(); } catch { iconUrl = null; }
  return { title, titleSource, description, descriptionSource, iconUrl };
}

export function detectImageType(bytes: Buffer): string|null {
  if (bytes.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.subarray(0,6).toString('ascii').match(/^GIF8[79]a$/)) return 'image/gif';
  if (bytes.subarray(0,4).toString('ascii') === 'RIFF' && bytes.subarray(8,12).toString('ascii') === 'WEBP') return 'image/webp';
  if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) return 'image/x-icon';
  return null;
}

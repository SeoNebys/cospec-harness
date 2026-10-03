import { load } from 'cheerio';

export interface ExtractedMetadata { title: string | null; description: string | null; iconUrl: string | null; previewUrl: string | null; warnings: string[] }
const clean = (value: string | undefined, max: number) => value ? [...value.replace(/\p{Cc}/gu, ' ').replace(/\s+/gu, ' ').trim()].slice(0, max).join('') || null : null;
const resolve = (value: string | undefined, base: URL) => { try { if (!value) return null; const url = new URL(value, base); return ['http:','https:'].includes(url.protocol) ? url.toString() : null; } catch { return null; } };

export function extractMetadata(html: Buffer | string, finalUrl: string): ExtractedMetadata {
  const $ = load(html.toString());
  let base = new URL(finalUrl); try { base = new URL($('base[href]').first().attr('href') || finalUrl, finalUrl); } catch { /* retain the final page URL */ }
  const content = (selector: string) => $(selector).first().attr('content');
  const title = clean(content('meta[property="og:title"]') || content('meta[name="twitter:title"]') || $('title').first().text(), 300);
  const description = clean(content('meta[property="og:description"]') || content('meta[name="description"]') || content('meta[name="twitter:description"]'), 2000);
  const icon = resolve($('link[rel~="icon"]').first().attr('href') || '/favicon.ico', base);
  const preview = resolve(content('meta[property="og:image"]') || content('meta[name="twitter:image"]') || content('meta[name="twitter:image:src"]'), base);
  const warnings: string[] = [];
  if (!title) warnings.push('missing_title'); if (!description) warnings.push('missing_description'); if (!icon) warnings.push('missing_icon'); if (!preview) warnings.push('missing_preview');
  return { title, description, iconUrl: icon, previewUrl: preview, warnings };
}

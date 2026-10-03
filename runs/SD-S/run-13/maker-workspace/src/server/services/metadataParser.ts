import { load } from 'cheerio';
import type { MetadataResult } from '../../shared/types.js';
import { fallbackTitle } from './urlPolicy.js';

const clean = (value: string | undefined, max: number): string | null => {
  const result = value?.replace(/\s+/g, ' ').trim();
  return result ? result.slice(0, max) : null;
};

export function parseMetadata(html: string, requestedUrl: URL, finalUrl: URL): MetadataResult {
  const $ = load(html);
  const title = clean($('meta[property="og:title"]').first().attr('content'), 200)
    ?? clean($('title').first().text(), 200) ?? fallbackTitle(finalUrl);
  const description = clean($('meta[name="description" i]').first().attr('content'), 500)
    ?? clean($('meta[property="og:description"]').first().attr('content'), 500);
  const found = Boolean($('title').length || $('meta[property="og:title"]').length || description);
  return { requestedUrl: requestedUrl.href, finalUrl: finalUrl.href, title, description, status: found ? 'retrieved' : 'fallback', warningCode: found ? null : 'MISSING_METADATA' };
}

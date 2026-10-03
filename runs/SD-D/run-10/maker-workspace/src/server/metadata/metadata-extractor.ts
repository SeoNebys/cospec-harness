import * as cheerio from 'cheerio';
import type { MetadataSource } from '../../shared/contracts/metadata.js';

export type ExtractedMetadata = {
  title: { value: string; source: MetadataSource; fallback: boolean };
  description: { value: string | null; source: MetadataSource };
  faviconUrl: { value: string | null; source: MetadataSource };
  previewImageUrl: { value: string | null; source: MetadataSource };
};

function content($: cheerio.CheerioAPI, selector: string): string | null {
  const value = $(selector).first().attr('content')?.trim();
  return value || null;
}

function absolute(value: string | null, baseUrl: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, baseUrl);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function extractMetadataFromHtml(html: string, baseUrl: string): ExtractedMetadata {
  const $ = cheerio.load(html);
  const ogTitle = content($, 'meta[property="og:title"]');
  const twitterTitle = content($, 'meta[name="twitter:title"], meta[property="twitter:title"]');
  const htmlTitle = $('title').first().text().trim() || null;
  const host = new URL(baseUrl).hostname;
  const title = ogTitle ?? twitterTitle ?? htmlTitle ?? host;
  const titleSource: MetadataSource = ogTitle
    ? 'open_graph'
    : twitterTitle
      ? 'twitter_card'
      : htmlTitle
        ? 'html_title'
        : 'host_fallback';

  const ogDescription = content($, 'meta[property="og:description"]');
  const twitterDescription = content(
    $,
    'meta[name="twitter:description"], meta[property="twitter:description"]',
  );
  const metaDescription = content($, 'meta[name="description"]');
  const description = ogDescription ?? twitterDescription ?? metaDescription;
  const descriptionSource: MetadataSource = ogDescription
    ? 'open_graph'
    : twitterDescription
      ? 'twitter_card'
      : 'meta_description';

  const ogImage = content($, 'meta[property="og:image:secure_url"], meta[property="og:image"]');
  const twitterImage = content($, 'meta[name="twitter:image"], meta[property="twitter:image"]');
  const previewImageUrl = absolute(ogImage ?? twitterImage, baseUrl);

  const iconHref =
    $('link[rel~="icon"]').first().attr('href')?.trim() ??
    $('link[rel="shortcut icon"]').first().attr('href')?.trim() ??
    null;
  const faviconUrl = absolute(iconHref, baseUrl) ?? new URL('/favicon.ico', baseUrl).href;

  return {
    title: { value: title.slice(0, 300), source: titleSource, fallback: titleSource === 'host_fallback' },
    description: { value: description?.slice(0, 1000) ?? null, source: descriptionSource },
    faviconUrl: { value: faviconUrl, source: iconHref ? 'link_icon' : 'favicon_fallback' },
    previewImageUrl: {
      value: previewImageUrl,
      source: ogImage ? 'open_graph' : 'twitter_card',
    },
  };
}

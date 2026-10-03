import type { MetadataPreview } from '../../shared/contracts/api.js';
import type { AppConfig } from '../config.js';
import { extractMetadata } from './extract-html.js';
import { cacheFirstValidIcon } from './icon-cache.js';
import { safeFetch } from './safe-fetch.js';
import { fallbackTitle, parsePublicHttpUrl, UrlPolicyError } from './url-policy.js';

export async function previewMetadata(requestedUrl: string, config: AppConfig): Promise<MetadataPreview> {
  const parsed = parsePublicHttpUrl(requestedUrl);
  try {
    const result = await safeFetch(parsed.href, { timeoutMs: config.METADATA_TIMEOUT_MS, maxBytes: config.METADATA_HTML_MAX_BYTES, maxRedirects: config.METADATA_MAX_REDIRECTS });
    const extracted = extractMetadata(new TextDecoder().decode(result.bytes), result.finalUrl);
    const iconToken = await cacheFirstValidIcon(extracted.iconCandidates, config.ICON_CACHE_PATH);
    const missing = !extracted.description || !iconToken;
    return {
      requestedUrl: parsed.href,
      finalUrl: result.finalUrl.href,
      outcome: missing ? 'partial' : 'complete',
      fields: {
        title: { status: 'found', value: extracted.title, source: extracted.titleSource },
        description: extracted.description ? { status: 'found', value: extracted.description, source: extracted.descriptionSource } : { status: 'missing', value: null, source: null },
        icon: iconToken ? { status: 'found', value: `/api/icons/${iconToken}`, source: 'page' } : { status: 'missing', value: null, source: null },
      },
      iconToken,
      warnings: missing ? ['Some page details were unavailable. You can still save this bookmark.'] : [],
    };
  } catch (error) {
    if (error instanceof UrlPolicyError && ['NON_PUBLIC_DESTINATION', 'URL_CREDENTIALS', 'UNSUPPORTED_PORT'].includes(error.code)) throw error;
    return {
      requestedUrl: parsed.href,
      finalUrl: null,
      outcome: 'failed',
      fields: {
        title: { status: 'found', value: fallbackTitle(parsed.href), source: 'fallback' },
        description: { status: 'fetch_failed', value: null, source: null },
        icon: { status: 'fetch_failed', value: null, source: null },
      },
      iconToken: null,
      warnings: ['Page details could not be retrieved. You can still save this bookmark.'],
    };
  }
}

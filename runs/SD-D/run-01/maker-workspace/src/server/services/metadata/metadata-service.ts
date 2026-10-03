import type { Env } from '../../config/env.js';
import { fallbackTitle, normalizeUrl } from '../../../shared/url/url-policy.js';
import { normalizeIcon } from './icon-normalizer.js';
import { parseMetadata } from './metadata-parser.js';
import { PreviewStore } from './preview-store.js';
import { safeFetch } from './safe-fetch.js';

export class MetadataService {
  constructor(private env: Env, private previews: PreviewStore) {}
  async preview(userId: string, submitted: string) {
    const normalized = normalizeUrl(submitted); const warnings: string[] = [];
    if (this.env.metadataTestFixtures && normalized.hostname === 'metadata.keepmark.test') {
      return { url: normalized.fetchUrl, canonicalKey: normalized.canonicalKey, status: 'retrieved', title: 'Deterministic metadata title', description: 'A fixed page description for browser acceptance tests.', iconAvailable: false, previewToken: this.previews.put(userId), warnings: [] };
    }
    let title = fallbackTitle(normalized.fetchUrl); let description = ''; let icon;
    try {
      const page = await safeFetch(normalized.fetchUrl, { timeoutMs: this.env.metadataTimeoutMs, maxBytes: this.env.metadataHtmlBytes, allowedTypes: ['text/html','application/xhtml+xml'] });
      const parsed = parseMetadata(page.body.toString('utf8'), page.url);
      title = parsed.title || title; description = parsed.description;
      if (!parsed.title) warnings.push('This page did not provide a title, so we used its site name.');
      for (const candidate of parsed.iconCandidates.slice(0, 4)) {
        try { icon = await normalizeIcon(await safeFetch(candidate, { timeoutMs: Math.min(this.env.metadataTimeoutMs, 3_000), maxBytes: this.env.metadataIconBytes, allowedTypes: ['image/*'] })); break; } catch { /* try next */ }
      }
      if (!icon) warnings.push('No usable site icon was available.');
    } catch { warnings.push('We could not reach this page. You can still review and save it.'); }
    const previewToken = this.previews.put(userId, icon);
    return { url: normalized.fetchUrl, canonicalKey: normalized.canonicalKey, status: warnings.some(w => w.includes('reach')) ? 'fallback' : warnings.length ? 'partial' : 'retrieved', title, description, iconAvailable: Boolean(icon), previewToken, warnings };
  }
}

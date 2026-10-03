import { canonicalizeUrl, displayHost, parseWebUrl } from './url.js';
import { CaptureError, capturePage, checkPageAvailability } from './capture.js';

export class DuplicateError extends Error {
  constructor(bookmark) {
    super('You already saved this page.');
    this.name = 'DuplicateError';
    this.code = 'duplicate';
    this.status = 409;
    this.bookmark = bookmark;
  }
}

export function createService(store, { allowPrivateFetch = false } = {}) {
  return {
    async saveUrl(url) {
      const inputCanonical = canonicalizeUrl(url);
      const inputDuplicate = store.findByCanonical(inputCanonical);
      if (inputDuplicate) throw new DuplicateError(inputDuplicate);
      let captured;
      try {
        captured = await capturePage(url, { allowPrivate: allowPrivateFetch });
      } catch (error) {
        if (error instanceof CaptureError) {
          error.url = parseWebUrl(url).toString();
        }
        throw error;
      }
      const finalCanonical = canonicalizeUrl(captured.finalUrl);
      const redirectDuplicate = store.findByCanonical(finalCanonical);
      if (redirectDuplicate) throw new DuplicateError(redirectDuplicate);
      return store.insertBookmark({
        url: captured.finalUrl,
        canonical_url: finalCanonical,
        title: captured.title,
        description: captured.description,
        source_host: captured.sourceHost,
        site_name: captured.siteName,
        author: captured.author,
        published_at: captured.publishedAt,
        preview_image: captured.previewImage,
        content_html: captured.contentHtml,
        capture_status: 'captured',
        captured_at: captured.capturedAt,
      });
    },

    saveManual({ url, title, description = '' }) {
      const canonical = canonicalizeUrl(url);
      const duplicate = store.findByCanonical(canonical);
      if (duplicate) throw new DuplicateError(duplicate);
      if (!String(title ?? '').trim()) {
        const error = new Error('Add a title so you can recognize this bookmark.');
        error.code = 'title_required'; error.status = 400; throw error;
      }
      const parsed = parseWebUrl(url);
      return store.insertBookmark({
        url: parsed.toString(),
        canonical_url: canonical,
        title: String(title).trim(),
        description: String(description).trim(),
        source_host: displayHost(url),
        site_name: displayHost(url),
        author: '',
        preview_image: '',
        content_html: '',
        capture_status: 'none',
        captured_at: null,
      });
    },

    async availability(id) {
      const bookmark = store.getBookmark(id);
      if (!bookmark) return null;
      if (bookmark.capture_status !== 'captured') return { available: false, reason: 'No saved page copy.' };
      return checkPageAvailability(bookmark.url, { allowPrivate: allowPrivateFetch });
    },
  };
}

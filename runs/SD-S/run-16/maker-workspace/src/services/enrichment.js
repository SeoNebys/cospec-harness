import { fetchMetadata as defaultFetchMetadata, titleFromUrl } from './metadata.js';
import { updateEnrichment } from '../models/bookmark.js';

// Background enrichment orchestration (research §3, choice A).
// The metadata fetcher is injectable so tests run offline/deterministically.

let fetcher = defaultFetchMetadata;

export function setFetcherForTesting(fn) {
  fetcher = fn || defaultFetchMetadata;
}

// When METADATA_STUB is set (e2e), use a synthetic fetcher so no network is hit.
if (process.env.METADATA_STUB) {
  fetcher = async (url) => ({
    title: `Preview of ${titleFromUrl(url)}`,
    description: 'Stubbed description for review.',
    faviconUrl: 'https://example.com/favicon.ico',
    previewImageUrl: 'https://example.com/preview.png',
  });
}

/**
 * Kick off enrichment off the request path. Never throws to the caller.
 * On success -> status 'ready'; on any failure/timeout -> status 'failed'
 * (keeping the URL-derived title, FR-004b).
 */
export function enqueue(bookmarkId, url) {
  const defaultTitle = titleFromUrl(url);
  // Detach from the request lifecycle.
  Promise.resolve()
    .then(() => fetcher(url))
    .then((meta) => {
      updateEnrichment(bookmarkId, {
        title: meta.title || defaultTitle,
        description: meta.description || null,
        faviconUrl: meta.faviconUrl || null,
        previewImageUrl: meta.previewImageUrl || null,
        status: 'ready',
        defaultTitle,
      });
      console.log(`[enrichment] bookmark ${bookmarkId} ready (${url})`);
    })
    .catch((err) => {
      updateEnrichment(bookmarkId, {
        title: defaultTitle,
        description: null,
        faviconUrl: null,
        previewImageUrl: null,
        status: 'failed',
        defaultTitle,
      });
      console.warn(
        `[enrichment] bookmark ${bookmarkId} failed (${url}): ${err.message}`
      );
    });
}

// Test helper: run enrichment and resolve when the update has been applied.
export async function enrichNow(bookmarkId, url) {
  const defaultTitle = titleFromUrl(url);
  try {
    const meta = await fetcher(url);
    updateEnrichment(bookmarkId, {
      title: meta.title || defaultTitle,
      description: meta.description || null,
      faviconUrl: meta.faviconUrl || null,
      previewImageUrl: meta.previewImageUrl || null,
      status: 'ready',
      defaultTitle,
    });
  } catch {
    updateEnrichment(bookmarkId, {
      title: defaultTitle,
      description: null,
      faviconUrl: null,
      previewImageUrl: null,
      status: 'failed',
      defaultTitle,
    });
  }
}

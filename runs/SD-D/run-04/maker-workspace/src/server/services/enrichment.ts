import type { DB } from '../db/connection';
import { applyEnrichment } from '../db/queries';
import { fetchMetadata } from './metadata';

// Background enrichment (research §3, FR-005). Saving returns immediately; the
// metadata fetch runs afterward and updates the bookmark when it resolves, so a
// slow or unreachable page never blocks or fails a save (SC-001).

/**
 * Kick off (fire-and-forget) a metadata fetch for a freshly created bookmark.
 * On success applies the preview details and marks `done`; on failure marks
 * `failed` (the card keeps whatever it already had). Errors are swallowed — this
 * runs in the background.
 *
 * Returns the promise so tests (and the import path) can await completion.
 */
export function enqueueEnrichment(db: DB, id: number, url: string): Promise<void> {
  return fetchMetadata(url)
    .then((meta) => {
      const gotSomething = meta.title || meta.description || meta.iconUrl || meta.imageUrl;
      applyEnrichment(db, id, gotSomething ? 'done' : 'failed', {
        title: meta.title,
        description: meta.description,
        iconUrl: meta.iconUrl ?? null,
        imageUrl: meta.imageUrl ?? null,
      });
    })
    .catch(() => {
      try {
        applyEnrichment(db, id, 'failed');
      } catch {
        /* bookmark may have been deleted meanwhile; ignore */
      }
    });
}

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FetchedPage } from './metadata.ts';
import { inlineResources } from './inline.ts';

export interface SnapshotResult {
  path: string;
  kind: 'html' | 'pdf';
}

function snapshotDir(bookmarkId: string): string {
  return join(process.cwd(), 'data', 'snapshots', bookmarkId);
}

/**
 * Persist a preserved copy of the page (FR-022).
 * - PDF link → the original PDF bytes are retained verbatim.
 * - HTML page → a SELF-CONTAINED snapshot with stylesheets, their assets, and
 *   images embedded, so it renders independently of the live site.
 * Returns null when there is nothing to store (fetch failed).
 */
export async function saveSnapshot(
  bookmarkId: string,
  page: FetchedPage,
): Promise<SnapshotResult | null> {
  if (!page.ok) return null;
  const dir = snapshotDir(bookmarkId);

  if (page.bytes && page.contentType.includes('pdf')) {
    mkdirSync(dir, { recursive: true });
    const path = join(dir, 'page.pdf');
    writeFileSync(path, page.bytes);
    return { path, kind: 'pdf' };
  }

  if (typeof page.body === 'string' && page.url) {
    const selfContained = await inlineResources(page.body, page.url);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, 'page.html');
    writeFileSync(path, selfContained, 'utf8');
    return { path, kind: 'html' };
  }
  return null;
}

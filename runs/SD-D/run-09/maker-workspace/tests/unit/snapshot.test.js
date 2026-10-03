import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let insertBookmark, getById, reopenDb, captureSnapshot, runSnapshotJob;

beforeEach(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'bm-snap-'));
  process.env.BOOKMARKS_DB = join(dir, 'test.db');
  process.env.SNAPSHOT_DIR = join(dir, 'snapshots');
  ({ reopenDb } = await import('../../src/server/db/connection.js'));
  reopenDb();
  ({ insertBookmark, getById } = await import('../../src/server/services/bookmarks.js'));
  ({ captureSnapshot, runSnapshotJob } = await import('../../src/server/services/snapshot.js'));
});

function pdfFetch() {
  return async () => ({
    ok: true,
    headers: { get: () => 'application/pdf' },
    arrayBuffer: async () => new TextEncoder().encode('%PDF-1.4 fake').buffer,
  });
}
function htmlFetch() {
  return async () => ({ ok: true, headers: { get: () => 'text/html' } });
}

describe('captureSnapshot content-type routing', () => {
  it('stores a PDF target as a PDF', async () => {
    const bm = insertBookmark({ url: 'https://x.example/doc.pdf', normalizedUrl: 'https://x.example/doc.pdf', title: 'Doc' });
    const result = await captureSnapshot(bm, { fetchImpl: pdfFetch() });
    expect(result.snapshotType).toBe('pdf');
    expect(result.snapshotStatus).toBe('available');
    expect(result.snapshotPath).toMatch(/\.pdf$/);
  });

  it('stores a web page as a single HTML file', async () => {
    const bm = insertBookmark({ url: 'https://x.example/page', normalizedUrl: 'https://x.example/page', title: 'Page' });
    const result = await captureSnapshot(bm, {
      fetchImpl: htmlFetch(),
      renderSingleFileHtml: async () => '<html><body>inlined</body></html>',
    });
    expect(result.snapshotType).toBe('html');
    expect(result.snapshotPath).toMatch(/\.html$/);
  });
});

describe('no-overwrite rule', () => {
  it('never modifies title/description; writes only snapshot fields', async () => {
    const bm = insertBookmark({
      url: 'https://x.example/page',
      normalizedUrl: 'https://x.example/page',
      title: 'My Edited Title',
      description: 'My Edited Description',
    });
    await runSnapshotJob(
      { bookmarkId: bm.id },
      { fetchImpl: htmlFetch(), renderSingleFileHtml: async () => '<html>ok</html>' }
    );
    const after = getById(bm.id);
    expect(after.title).toBe('My Edited Title');
    expect(after.description).toBe('My Edited Description');
    expect(after.snapshotStatus).toBe('available');
    expect(after.snapshotType).toBe('html');
  });

  it('marks unavailable when capture fails, still not touching title', async () => {
    const bm = insertBookmark({
      url: 'https://x.example/page',
      normalizedUrl: 'https://x.example/page',
      title: 'Keep Me',
      description: 'Keep This',
    });
    await runSnapshotJob(
      { bookmarkId: bm.id },
      { fetchImpl: htmlFetch(), renderSingleFileHtml: async () => null }
    );
    const after = getById(bm.id);
    expect(after.title).toBe('Keep Me');
    expect(after.description).toBe('Keep This');
    expect(after.snapshotStatus).toBe('unavailable');
  });
});

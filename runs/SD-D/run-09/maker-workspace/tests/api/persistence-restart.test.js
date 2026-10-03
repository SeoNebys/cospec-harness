import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// This test simulates a real process restart against the same on-disk DB by
// closing and reopening the database connection (not merely reloading a page).
describe('restart persistence (SC-010) + snapshot recovery', () => {
  it('preserves everything and recovers a pending snapshot after restart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bm-restart-'));
    process.env.BOOKMARKS_DB = join(dir, 'test.db');
    process.env.SNAPSHOT_DIR = join(dir, 'snapshots');

    const conn = await import('../../src/server/db/connection.js');
    const bookmarks = await import('../../src/server/services/bookmarks.js');
    const filters = await import('../../src/server/services/filters.js');
    const prefs = await import('../../src/server/services/preferences.js');
    const jobQueue = await import('../../src/server/services/jobQueue.js');
    const snapshot = await import('../../src/server/services/snapshot.js');

    conn.reopenDb();

    // Create state: an edited+tagged bookmark, an archived one, a completed
    // snapshot, a saved filter, and custom preferences.
    const a = bookmarks.insertBookmark({
      url: 'https://example.com/a',
      normalizedUrl: 'https://example.com/a',
      title: 'Edited Title',
      description: 'Edited Desc',
      note: '# note',
      tags: ['keep', 'work'],
      read: true,
      snapshotStatus: 'available',
      snapshotType: 'html',
      snapshotPath: join(dir, 'snapshots', 'a.html'),
    });
    bookmarks.insertBookmark({
      url: 'https://example.com/b',
      normalizedUrl: 'https://example.com/b',
      title: 'Archived',
      archived: true,
      snapshotStatus: 'available',
    });
    // One still pending (interrupted capture).
    const pendingBm = bookmarks.insertBookmark({
      url: 'https://example.com/c',
      normalizedUrl: 'https://example.com/c',
      title: 'Pending Snapshot',
      snapshotStatus: 'pending',
    });
    filters.createFilter({ name: 'Work', query: 'edited', includeTags: ['work'], excludeTags: [] });
    prefs.updatePreferences({ defaultSort: 'title_asc', itemsPerPage: 50, fontSize: 'large' });

    // --- RESTART: close and reopen the DB connection ---
    conn.reopenDb();

    // Re-import services after reopen (module state persists; getDb reads new handle).
    const bookmarks2 = await import('../../src/server/services/bookmarks.js');
    const filters2 = await import('../../src/server/services/filters.js');
    const prefs2 = await import('../../src/server/services/preferences.js');

    const gotA = bookmarks2.getById(a.id);
    expect(gotA.title).toBe('Edited Title');
    expect(gotA.description).toBe('Edited Desc');
    expect(gotA.note).toBe('# note');
    expect(gotA.tags.sort()).toEqual(['keep', 'work']);
    expect(gotA.read).toBe(true);
    expect(gotA.snapshotStatus).toBe('available');
    expect(gotA.snapshotType).toBe('html');

    expect(bookmarks2.listForView('archived').length).toBe(1);
    expect(filters2.listFilters().length).toBe(1);
    expect(prefs2.getPreferences()).toEqual({
      defaultSort: 'title_asc',
      itemsPerPage: 50,
      fontSize: 'large',
    });

    // --- Snapshot recovery: pending capture resumes and completes ---
    jobQueue._resetForTests();
    jobQueue.registerHandler('snapshot', ({ bookmarkId }) => {
      bookmarks2.updateBookmark(bookmarkId, { snapshotStatus: 'available', snapshotType: 'html' }, { touch: false });
    });
    const count = snapshot.recoverPendingSnapshots();
    expect(count).toBe(1);
    await jobQueue.waitForIdle();
    expect(bookmarks2.getById(pendingBm.id).snapshotStatus).toBe('available');
  });
});

import { describe, it, expect, beforeAll } from 'vitest';

// Use an in-memory database so the test is isolated from the real data file.
process.env.BOOKMARKS_DB = ':memory:';

let Bookmarks;

beforeAll(async () => {
  const { migrate } = await import('../../server/db/migrations.js');
  migrate();
  Bookmarks = await import('../../server/models/bookmark.js');
});

function inView(view) {
  return Bookmarks.listRaw({ view }).map((r) => r.url);
}

describe('read/unread and archived are independent axes', () => {
  it('derives the three views correctly', () => {
    // unread + unarchived
    const a = Bookmarks.create({ url: 'https://a.test/', title: 'A' });
    // read + unarchived
    const b = Bookmarks.create({ url: 'https://b.test/', title: 'B' });
    Bookmarks.update(b.id, { isRead: true });
    // unread + archived (the client's case)
    const c = Bookmarks.create({ url: 'https://c.test/', title: 'C' });
    Bookmarks.update(c.id, { isArchived: true });

    expect(inView('normal').sort()).toEqual(['https://a.test/', 'https://b.test/']);
    expect(inView('read_later')).toEqual(['https://a.test/']); // unread AND not archived
    expect(inView('archive')).toEqual(['https://c.test/']);
  });

  it('archiving then restoring never changes read/unread', () => {
    const d = Bookmarks.create({ url: 'https://d.test/', title: 'D' }); // unread
    Bookmarks.update(d.id, { isArchived: true });
    let raw = Bookmarks.getRawById(d.id);
    expect(raw.is_archived).toBe(1);
    expect(raw.is_read).toBe(0); // still unread while archived

    Bookmarks.update(d.id, { isArchived: false }); // restore
    raw = Bookmarks.getRawById(d.id);
    expect(raw.is_archived).toBe(0);
    expect(raw.is_read).toBe(0); // still unread -> back in read-later view
    expect(inView('read_later')).toContain('https://d.test/');
  });

  it('toggling read does not change archived', () => {
    const e = Bookmarks.create({ url: 'https://e.test/', title: 'E' });
    Bookmarks.update(e.id, { isArchived: true });
    Bookmarks.update(e.id, { isRead: true });
    const raw = Bookmarks.getRawById(e.id);
    expect(raw.is_read).toBe(1);
    expect(raw.is_archived).toBe(1); // unchanged by the read toggle
  });
});

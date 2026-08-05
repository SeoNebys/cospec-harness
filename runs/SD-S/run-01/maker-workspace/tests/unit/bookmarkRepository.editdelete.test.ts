import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/data/db';
import { add, update, remove, get } from '../../src/data/bookmarkRepository';
import { ValidationError } from '../../src/models/bookmark';

beforeEach(async () => {
  await db.bookmarks.clear();
});

describe('update', () => {
  it('applies changes, preserves dateSaved, and bumps dateModified (FR-007, VR-005)', async () => {
    const bm = await add({ url: 'example.com', title: 'Old' });
    await new Promise((r) => setTimeout(r, 5));
    const updated = await update(bm.id, { title: 'New' });

    expect(updated.title).toBe('New');
    expect(updated.dateSaved).toBe(bm.dateSaved);
    expect(updated.dateModified).toBeGreaterThan(bm.dateModified);
  });

  it('re-validates the url when it changes', async () => {
    const bm = await add({ url: 'example.com', title: 'X' });
    await expect(update(bm.id, { url: 'not a url' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('re-derives the title when cleared', async () => {
    const bm = await add({ url: 'https://example.com/post', title: 'Named' });
    const updated = await update(bm.id, { title: '' });
    expect(updated.title).toBe('example.com/post');
  });
});

describe('remove', () => {
  it('deletes a bookmark (FR-008)', async () => {
    const bm = await add({ url: 'example.com', title: 'X' });
    await remove(bm.id);
    expect(await get(bm.id)).toBeUndefined();
  });
});

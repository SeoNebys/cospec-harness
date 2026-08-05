import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/data/db';
import { add, findByUrl } from '../../src/data/bookmarkRepository';
import { ValidationError } from '../../src/models/bookmark';

beforeEach(async () => {
  await db.bookmarks.clear();
});

describe('add', () => {
  it('creates a bookmark with normalized url and generated fields', async () => {
    const bm = await add({ url: 'example.com', title: 'Example' });
    expect(bm.id).toBeTruthy();
    expect(bm.url).toBe('https://example.com/');
    expect(bm.title).toBe('Example');
    expect(bm.dateSaved).toBeGreaterThan(0);
    expect(bm.dateModified).toBe(bm.dateSaved);
    expect(await db.bookmarks.get(bm.id)).toMatchObject({ title: 'Example' });
  });

  it('derives a title from the url when title is blank (VR-002)', async () => {
    const bm = await add({ url: 'https://example.com/post', title: '   ' });
    expect(bm.title).toBe('example.com/post');
  });

  it('rejects an empty or malformed url (VR-001)', async () => {
    await expect(add({ url: '' })).rejects.toBeInstanceOf(ValidationError);
    await expect(add({ url: 'not a url', title: 'x' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('trims and de-duplicates tags case-insensitively (VR-003)', async () => {
    const bm = await add({ url: 'example.com', tags: [' work ', 'Work', 'read', ''] });
    expect(bm.tags).toEqual(['work', 'read']);
  });
});

describe('findByUrl', () => {
  it('finds existing bookmarks with the same normalized url (VR-004)', async () => {
    await add({ url: 'https://example.com/', title: 'One' });
    const matches = await findByUrl('example.com'); // normalizes to same href
    expect(matches).toHaveLength(1);
    expect(matches[0].title).toBe('One');
  });

  it('returns empty for an unknown or invalid url', async () => {
    expect(await findByUrl('https://nope.test/')).toEqual([]);
    expect(await findByUrl('')).toEqual([]);
  });
});

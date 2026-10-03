import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookmarkDatabase } from '../../../src/server/db/client.js';
import { openDatabase } from '../../../src/server/db/client.js';
import { runMigrations } from '../../../src/server/db/migrations.js';
import { BookmarkNotFoundError, BookmarkRepository, DuplicateBookmarkError } from '../../../src/server/db/bookmark-repository.js';

let database: BookmarkDatabase;
let repository: BookmarkRepository;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-24T10:00:00.000Z'));
  database = openDatabase(':memory:');
  runMigrations(database);
  repository = new BookmarkRepository(database);
});
afterEach(() => { database.close(); vi.useRealTimers(); });

describe('bookmark maintenance repository', () => {
  it('updates fields and tags atomically while preserving creation time', () => {
    const saved = repository.create({ url: 'https://one.example', title: 'One', description: null, tags: ['Old'], allowDuplicate: false });
    vi.setSystemTime(new Date('2026-09-24T11:00:00.000Z'));
    const updated = repository.update(saved.id, { url: 'https://new.example', title: 'New title', description: 'New description', tags: ['Fresh'], allowDuplicate: false });
    expect(updated).toMatchObject({ title: 'New title', description: 'New description', tags: ['Fresh'], createdAt: saved.createdAt });
    expect(updated.updatedAt).toBe('2026-09-24T11:00:00.000Z');
    expect(repository.listTags()).toEqual([{ name: 'Fresh', count: 1 }]);
  });

  it('requires duplicate override on an update', () => {
    const first = repository.create({ url: 'https://one.example', title: 'One', description: null, tags: [], allowDuplicate: false });
    const second = repository.create({ url: 'https://two.example', title: 'Two', description: null, tags: [], allowDuplicate: false });
    expect(() => repository.update(second.id, { url: first.url, allowDuplicate: false })).toThrow(DuplicateBookmarkError);
    expect(repository.update(second.id, { url: first.url, allowDuplicate: true }).url).toBe(first.url);
  });

  it('deletes associations and reports missing records', () => {
    const saved = repository.create({ url: 'https://one.example', title: 'One', description: null, tags: ['Only'], allowDuplicate: false });
    expect(repository.delete(saved.id)).toBe(true);
    expect(repository.delete(saved.id)).toBe(false);
    expect(repository.listTags()).toEqual([]);
    expect(() => repository.update(saved.id, { title: 'Missing', allowDuplicate: false })).toThrow(BookmarkNotFoundError);
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DuplicateUrlError, NotFoundError } from '../errors.js';
import { BookmarkRepository } from './bookmark-repository.js';
import {
  createTemporaryDatabase,
  type TemporaryDatabase,
} from '../../../tests/helpers/database.js';

describe('BookmarkRepository mutations', () => {
  let temporary: TemporaryDatabase;
  let repository: BookmarkRepository;
  let tick: number;

  beforeEach(() => {
    temporary = createTemporaryDatabase();
    tick = 0;
    repository = new BookmarkRepository(
      temporary.db,
      () => `2026-09-25T12:00:${String(tick++).padStart(2, '0')}.000Z`,
    );
  });
  afterEach(() => temporary.close());

  it('atomically replaces details/tags and advances the timestamp', () => {
    const created = repository.create({
      title: 'Before',
      url: 'https://example.com/before',
      notes: '',
      tags: ['Old', 'Shared'],
    });
    const updated = repository.update(created.id, {
      title: 'After',
      url: 'https://example.com/after',
      notes: 'Updated',
      tags: ['New', 'Shared'],
    });
    expect(updated).toMatchObject({
      title: 'After',
      url: 'https://example.com/after',
      notes: 'Updated',
      tags: ['New', 'Shared'],
      createdAt: created.createdAt,
      updatedAt: '2026-09-25T12:00:01.000Z',
    });
    expect(repository.listTags()).not.toContainEqual(expect.objectContaining({ name: 'Old' }));
  });

  it('excludes itself but rejects another bookmark during duplicate checks', () => {
    const first = repository.create({
      title: 'First',
      url: 'https://example.com/a',
      notes: '',
      tags: [],
    });
    const second = repository.create({
      title: 'Second',
      url: 'https://example.com/b',
      notes: '',
      tags: [],
    });
    expect(repository.update(first.id, { url: 'https://example.com/a/' }).id).toBe(first.id);
    expect(() => repository.update(second.id, { url: 'https://example.com/a' })).toThrowError(
      new DuplicateUrlError(first.id),
    );
  });

  it('keeps favorite and archive states independent and restores', () => {
    const created = repository.create({
      title: 'State',
      url: 'https://example.com/state',
      notes: '',
      tags: [],
    });
    const favorite = repository.update(created.id, { isFavorite: true });
    const archived = repository.update(created.id, { isArchived: true });
    const restored = repository.update(created.id, { isArchived: false });
    expect(favorite.isFavorite).toBe(true);
    expect(archived).toMatchObject({ isFavorite: true, isArchived: true });
    expect(restored).toMatchObject({ isFavorite: true, isArchived: false });
  });

  it('deletes relationships, cleans orphan tags, and reports missing records', () => {
    const created = repository.create({
      title: 'Delete',
      url: 'https://example.com/delete',
      notes: '',
      tags: ['Only'],
    });
    repository.delete(created.id);
    expect(() => repository.get(created.id)).toThrowError(NotFoundError);
    expect(repository.listTags()).toEqual([]);
    expect(() => repository.delete(created.id)).toThrowError(NotFoundError);
  });
});

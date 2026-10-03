import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { BookmarkDatabase } from '../db/database.js';
import { closeDatabase, openDatabase } from '../db/database.js';
import { DuplicateUrlError } from '../errors.js';
import { BookmarkRepository } from './bookmark-repository.js';
import {
  createTemporaryDatabase,
  type TemporaryDatabase,
} from '../../../tests/helpers/database.js';

describe('BookmarkRepository create/list/get', () => {
  let temporary: TemporaryDatabase;
  let db: BookmarkDatabase;
  let repository: BookmarkRepository;

  beforeEach(() => {
    temporary = createTemporaryDatabase();
    db = temporary.db;
    repository = new BookmarkRepository(db, () => '2026-09-25T12:00:00.000Z');
  });

  afterEach(() => {
    if (db !== temporary.db) closeDatabase(db);
    temporary.close();
  });

  it('creates, lists, and gets a bookmark with tags and default states', () => {
    const created = repository.create({
      title: 'OpenAI',
      url: 'https://openai.com/research/',
      notes: 'Read later',
      tags: ['Research', ' research ', 'AI'],
    });

    expect(created).toMatchObject({
      id: 1,
      title: 'OpenAI',
      url: 'https://openai.com/research/',
      notes: 'Read later',
      tags: ['Research', 'AI'],
      isFavorite: false,
      isArchived: false,
      createdAt: '2026-09-25T12:00:00.000Z',
      updatedAt: '2026-09-25T12:00:00.000Z',
    });
    expect(repository.get(created.id)).toEqual(created);
    expect(repository.list()).toEqual({ items: [created], total: 1 });
  });

  it('rejects normalized duplicate URLs and identifies the existing bookmark', () => {
    const existing = repository.create({
      title: 'Docs',
      url: 'HTTPS://Example.com:443/docs/',
      notes: '',
      tags: [],
    });
    expect(() =>
      repository.create({
        title: 'Duplicate',
        url: 'https://example.com/docs',
        notes: '',
        tags: [],
      }),
    ).toThrowError(new DuplicateUrlError(existing.id));
  });

  it('persists after closing and reopening the database', () => {
    const created = repository.create({
      title: 'Persistent',
      url: 'https://example.com/persistent',
      notes: '',
      tags: [],
    });
    closeDatabase(db);
    db = openDatabase({ path: temporary.path });
    repository = new BookmarkRepository(db);
    expect(repository.get(created.id)?.title).toBe('Persistent');
  });
});

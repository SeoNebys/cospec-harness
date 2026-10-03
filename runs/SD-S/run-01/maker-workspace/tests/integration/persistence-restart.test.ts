import { describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/server/db/connection.js';
import { runMigrations } from '../../src/server/db/migrate.js';
import { BookmarkRepository } from '../../src/server/repositories/bookmark-repository.js';
import { BookmarkService } from '../../src/server/services/bookmark-service.js';
import { createTestDatabase } from '../helpers/database.js';

describe('restart persistence', () => {
  it('retains a bookmark after the database connection closes and reopens', () => {
    const test = createTestDatabase();
    new BookmarkService(new BookmarkRepository(test.database), () => '2026-09-16T12:00:00.000Z', () => '40000000-0000-4000-8000-000000000001').create({ url: 'https://example.com/persist', title: 'Persistent', notes: '', tags: [], allowDuplicate: false });
    test.database.close();
    const reopened = openDatabase(test.path); runMigrations(reopened);
    expect(new BookmarkRepository(reopened).getById('40000000-0000-4000-8000-000000000001')?.title).toBe('Persistent');
    reopened.close(); test.cleanup();
  });
});

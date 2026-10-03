import { closeDatabase } from '../../src/server/db/connection.js';
import { BookmarkRepository } from '../../src/server/db/bookmark-repository.js';
import {
  BookmarkService,
  DuplicateBookmarkError,
} from '../../src/server/services/bookmark-service.js';
import {
  buildBookmarkInput,
  createDeterministicClock,
  createDeterministicUuidFactory,
  FIXED_BOOKMARK_ID,
  FIXED_NOW,
} from '../fixtures/bookmarks.js';
import {
  createTemporaryDatabase,
  type TemporaryDatabase,
} from '../fixtures/database.js';

function rowCount(database: TemporaryDatabase['database'], table: string): number {
  const row = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
    count: number;
  };
  return row.count;
}

describe('bookmark creation repository and service', () => {
  let fixture: TemporaryDatabase | undefined;

  afterEach(() => {
    fixture?.cleanup();
    fixture = undefined;
  });

  function createSubject(
    database: TemporaryDatabase['database'],
    uuidStart = 1,
  ): BookmarkService {
    const repository = new BookmarkRepository(database, {
      now: createDeterministicClock(),
      createId: createDeterministicUuidFactory(uuidStart),
    });
    return new BookmarkService(repository);
  }

  it('atomically creates, lists, and gets a bookmark with canonical fields', () => {
    fixture = createTemporaryDatabase();
    const service = createSubject(fixture.database);

    const created = service.createBookmark(
      buildBookmarkInput({
        url: '  HTTPS://Example.COM:443/articles/testing#intro  ',
        title: '  A representative bookmark  ',
        description: '  Useful notes.  ',
        tags: [' Research ', 'Testing', 'ｒｅｓｅａｒｃｈ'],
      }),
    );

    expect(created).toEqual({
      id: FIXED_BOOKMARK_ID,
      url: 'https://example.com/articles/testing#intro',
      title: 'A representative bookmark',
      description: 'Useful notes.',
      tags: ['Research', 'Testing'],
      readingState: 'to_read',
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
    });
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    expect(service.getBookmark(created.id)).toEqual(created);
    expect(service.listBookmarks()).toEqual({ items: [created], total: 1 });
    expect(rowCount(fixture.database, 'bookmarks')).toBe(1);
    expect(rowCount(fixture.database, 'tags')).toBe(2);
    expect(rowCount(fixture.database, 'bookmark_tags')).toBe(2);
  });

  it('reuses normalized tags and preserves their first-entered display spelling', () => {
    fixture = createTemporaryDatabase();
    const service = createSubject(fixture.database);

    const first = service.createBookmark(
      buildBookmarkInput({
        url: 'https://example.com/first',
        title: 'First',
        tags: ['Design'],
      }),
    );
    const second = service.createBookmark(
      buildBookmarkInput({
        url: 'https://example.com/second',
        title: 'Second',
        tags: [' design '],
      }),
    );

    expect(first.tags).toEqual(['Design']);
    expect(second.tags).toEqual(['Design']);
    expect(rowCount(fixture.database, 'tags')).toBe(1);
    expect(rowCount(fixture.database, 'bookmark_tags')).toBe(2);
  });

  it('returns a 409-style duplicate error and creates nothing until explicitly overridden', () => {
    fixture = createTemporaryDatabase();
    const service = createSubject(fixture.database);
    const first = service.createBookmark(
      buildBookmarkInput({
        url: 'HTTPS://Example.COM:443/docs#first',
        title: 'First copy',
        tags: [],
      }),
    );

    let thrown: unknown;
    try {
      service.createBookmark(
        buildBookmarkInput({
          url: 'https://example.com/docs#second',
          title: 'Second copy',
          tags: ['new-tag'],
        }),
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(DuplicateBookmarkError);
    expect(thrown).toMatchObject({
      statusCode: 409,
      code: 'DUPLICATE_URL',
      existingBookmark: first,
    });
    expect(rowCount(fixture.database, 'bookmarks')).toBe(1);
    expect(rowCount(fixture.database, 'tags')).toBe(0);

    const duplicate = service.createBookmark(
      buildBookmarkInput({
        url: 'https://example.com/docs#second',
        title: 'Second copy',
        tags: ['new-tag'],
        allowDuplicate: true,
      }),
    );
    expect(duplicate.id).not.toBe(first.id);
    expect(duplicate.url).toBe('https://example.com/docs#second');
    expect(service.listBookmarks().total).toBe(2);
  });

  it('rolls back the bookmark and all tags when an association transaction fails', () => {
    fixture = createTemporaryDatabase();
    const service = createSubject(fixture.database);
    fixture.database.exec(`
      CREATE TRIGGER reject_exploding_tag
      BEFORE INSERT ON tags
      WHEN NEW.normalized_name = 'explode'
      BEGIN
        SELECT RAISE(ABORT, 'forced tag failure');
      END;
    `);

    expect(() =>
      service.createBookmark(
        buildBookmarkInput({ tags: ['Research', 'explode'] }),
      ),
    ).toThrow(/forced tag failure/);

    expect(rowCount(fixture.database, 'bookmarks')).toBe(0);
    expect(rowCount(fixture.database, 'tags')).toBe(0);
    expect(rowCount(fixture.database, 'bookmark_tags')).toBe(0);
  });

  it('validates before mutation and leaves existing data unchanged', () => {
    fixture = createTemporaryDatabase();
    const service = createSubject(fixture.database);
    const existing = service.createBookmark(
      buildBookmarkInput({ tags: ['Existing'] }),
    );

    expect(() =>
      service.createBookmark(
        buildBookmarkInput({
          url: 'file:///etc/passwd',
          title: '   ',
          tags: ['Should not persist'],
        }),
      ),
    ).toThrow();

    expect(service.listBookmarks()).toEqual({ items: [existing], total: 1 });
    expect(rowCount(fixture.database, 'bookmarks')).toBe(1);
    expect(rowCount(fixture.database, 'tags')).toBe(1);
    expect(rowCount(fixture.database, 'bookmark_tags')).toBe(1);
  });

  it('retains created bookmarks and tag mappings after closing and reopening SQLite', () => {
    fixture = createTemporaryDatabase();
    const service = createSubject(fixture.database);
    const created = service.createBookmark(buildBookmarkInput());
    closeDatabase(fixture.database);

    const reopened = fixture.openConnection();
    const reopenedService = createSubject(reopened, 100);

    expect(reopenedService.getBookmark(created.id)).toEqual(created);
    expect(reopenedService.listBookmarks()).toEqual({
      items: [created],
      total: 1,
    });
  });
});

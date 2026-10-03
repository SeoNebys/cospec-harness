import request from 'supertest';

import { createApp } from '../../src/server/app.js';
import { BookmarkRepository } from '../../src/server/db/bookmark-repository.js';
import { registerBookmarkRoutes } from '../../src/server/routes/bookmarks.js';
import { BookmarkService } from '../../src/server/services/bookmark-service.js';
import {
  buildBookmarkInput,
  createDeterministicClock,
  createDeterministicUuidFactory,
} from '../fixtures/bookmarks.js';
import {
  createTemporaryDatabase,
  type TemporaryDatabase,
} from '../fixtures/database.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000999';

function rowCount(database: TemporaryDatabase['database'], table: string): number {
  return (
    database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
      count: number;
    }
  ).count;
}

describe('bookmark replacement and deletion', () => {
  let fixture: TemporaryDatabase | undefined;

  afterEach(() => {
    fixture?.cleanup();
    fixture = undefined;
  });

  function createSubject(): BookmarkService {
    fixture = createTemporaryDatabase();
    return new BookmarkService(
      new BookmarkRepository(fixture.database, {
        now: createDeterministicClock(),
        createId: createDeterministicUuidFactory(),
      }),
    );
  }

  function createHttpSubject(service: BookmarkService) {
    return createApp({
      registerRoutes: (app) => registerBookmarkRoutes(app, { bookmarkService: service }),
    });
  }

  it('atomically replaces every editable field while preserving createdAt and changing updatedAt', async () => {
    const service = createSubject();
    const app = createHttpSubject(service);
    const original = service.createBookmark(
      buildBookmarkInput({
        url: 'https://example.com/original',
        title: 'Original title',
        description: 'Original description',
        tags: ['Original'],
        readingState: 'untracked',
      }),
    );

    const response = await request(app)
      .put(`/api/bookmarks/${original.id}`)
      .send({
        url: ' HTTPS://Example.COM:443/updated#section ',
        title: ' Updated title ',
        description: ' Updated description ',
        tags: ['Updated', 'Notes'],
        readingState: 'to_read',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: original.id,
      url: 'https://example.com/updated#section',
      title: 'Updated title',
      description: 'Updated description',
      tags: ['Updated', 'Notes'],
      readingState: 'to_read',
      createdAt: original.createdAt,
      updatedAt: '2026-09-26T12:00:01.000Z',
    });
    expect(response.body.updatedAt).not.toBe(original.updatedAt);
    expect(service.getBookmark(original.id)).toEqual(response.body);
    expect(service.listBookmarks()).toEqual({ items: [response.body], total: 1 });
  });

  it('excludes the current bookmark from duplicate detection during replacement', () => {
    const service = createSubject();
    const original = service.createBookmark(
      buildBookmarkInput({
        url: 'https://example.com/same-resource#before',
        tags: [],
      }),
    );

    const updated = service.replaceBookmark(
      original.id,
      buildBookmarkInput({
        url: 'HTTPS://EXAMPLE.COM:443/same-resource#after',
        title: 'Updated without a false duplicate',
        tags: [],
      }),
    );

    expect(updated).toMatchObject({
      id: original.id,
      url: 'https://example.com/same-resource#after',
      title: 'Updated without a false duplicate',
      createdAt: original.createdAt,
    });
  });

  it('returns duplicate conflict data and changes nothing unless override is explicit', async () => {
    const service = createSubject();
    const app = createHttpSubject(service);
    const existing = service.createBookmark(
      buildBookmarkInput({
        url: 'https://example.com/shared#one',
        title: 'Existing',
        tags: ['ExistingTag'],
      }),
    );
    const edited = service.createBookmark(
      buildBookmarkInput({
        url: 'https://example.com/different',
        title: 'Edited',
        tags: ['EditedTag'],
      }),
    );

    const conflict = await request(app)
      .put(`/api/bookmarks/${edited.id}`)
      .send(
        buildBookmarkInput({
          url: 'https://example.com/shared#two',
          title: 'Conflicting edit',
          tags: ['ShouldNotPersist'],
        }),
      );

    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({
      error: {
        code: 'DUPLICATE_URL',
        message: expect.any(String),
      },
      existingBookmark: existing,
    });
    expect(service.getBookmark(edited.id)).toEqual(edited);
    expect(service.listTags().items.map(({ normalizedName }) => normalizedName)).toEqual([
      'editedtag',
      'existingtag',
    ]);

    const override = await request(app)
      .put(`/api/bookmarks/${edited.id}`)
      .send(
        buildBookmarkInput({
          url: 'https://example.com/shared#two',
          title: 'Intentional duplicate',
          tags: ['ReplacementTag'],
          allowDuplicate: true,
        }),
      );

    expect(override.status).toBe(200);
    expect(override.body).toMatchObject({
      id: edited.id,
      url: 'https://example.com/shared#two',
      title: 'Intentional duplicate',
      tags: ['ReplacementTag'],
    });
    expect(service.listBookmarks().total).toBe(2);
  });

  it('reuses retained tags and removes tags orphaned by replacement', () => {
    const service = createSubject();
    const first = service.createBookmark(
      buildBookmarkInput({
        url: 'https://example.com/first',
        tags: ['Shared', 'Orphan'],
      }),
    );
    service.createBookmark(
      buildBookmarkInput({
        url: 'https://example.com/second',
        tags: ['shared'],
      }),
    );
    const sharedBefore = fixture!.database
      .prepare("SELECT id FROM tags WHERE normalized_name = 'shared'")
      .get() as { id: string };

    const updated = service.replaceBookmark(
      first.id,
      buildBookmarkInput({
        url: first.url,
        title: first.title,
        description: first.description,
        tags: ['shared', 'New'],
        readingState: first.readingState,
      }),
    );
    const sharedAfter = fixture!.database
      .prepare("SELECT id FROM tags WHERE normalized_name = 'shared'")
      .get() as { id: string };

    expect(updated.tags).toEqual(['Shared', 'New']);
    expect(sharedAfter.id).toBe(sharedBefore.id);
    expect(
      fixture!.database
        .prepare("SELECT id FROM tags WHERE normalized_name = 'orphan'")
        .get(),
    ).toBeUndefined();
    expect(service.listTags()).toEqual({
      items: [
        { name: 'New', normalizedName: 'new', bookmarkCount: 1 },
        { name: 'Shared', normalizedName: 'shared', bookmarkCount: 2 },
      ],
    });
  });

  it('rolls back bookmark fields, associations, and tag inserts when replacement fails', () => {
    const service = createSubject();
    const original = service.createBookmark(
      buildBookmarkInput({
        url: 'https://example.com/original',
        title: 'Original',
        description: 'Original description',
        tags: ['OriginalTag'],
        readingState: 'untracked',
      }),
    );
    fixture!.database.exec(`
      CREATE TRIGGER reject_replacement_tag
      BEFORE INSERT ON tags
      WHEN NEW.normalized_name = 'explode'
      BEGIN
        SELECT RAISE(ABORT, 'forced replacement failure');
      END;
    `);

    expect(() =>
      service.replaceBookmark(
        original.id,
        buildBookmarkInput({
          url: 'https://example.com/changed',
          title: 'Changed',
          description: 'Changed description',
          tags: ['ReplacementTag', 'explode'],
          readingState: 'read',
        }),
      ),
    ).toThrow(/forced replacement failure/);

    expect(service.getBookmark(original.id)).toEqual(original);
    expect(
      fixture!.database
        .prepare('SELECT display_name, normalized_name FROM tags ORDER BY normalized_name')
        .all(),
    ).toEqual([{ display_name: 'OriginalTag', normalized_name: 'originaltag' }]);
    expect(rowCount(fixture!.database, 'bookmark_tags')).toBe(1);
  });

  it('returns the documented not-found error for replacement and deletion', async () => {
    const service = createSubject();
    const app = createHttpSubject(service);

    const replacement = await request(app)
      .put(`/api/bookmarks/${MISSING_ID}`)
      .send(buildBookmarkInput({ tags: [] }));
    expect(replacement.status).toBe(404);
    expect(replacement.body).toEqual({
      error: {
        code: 'BOOKMARK_NOT_FOUND',
        message: expect.any(String),
      },
    });

    const deletion = await request(app).delete(`/api/bookmarks/${MISSING_ID}`);
    expect(deletion.status).toBe(404);
    expect(deletion.body).toEqual({
      error: {
        code: 'BOOKMARK_NOT_FOUND',
        message: expect.any(String),
      },
    });
  });

  it('cascades associations and removes orphan tags when a bookmark is deleted', async () => {
    const service = createSubject();
    const app = createHttpSubject(service);
    const bookmark = service.createBookmark(
      buildBookmarkInput({ tags: ['UniqueTag'] }),
    );
    expect(rowCount(fixture!.database, 'bookmark_tags')).toBe(1);

    const response = await request(app).delete(`/api/bookmarks/${bookmark.id}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(rowCount(fixture!.database, 'bookmarks')).toBe(0);
    expect(rowCount(fixture!.database, 'bookmark_tags')).toBe(0);
    expect(rowCount(fixture!.database, 'tags')).toBe(0);
    expect(service.listBookmarks()).toEqual({ items: [], total: 0 });
  });
});

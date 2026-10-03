import request from 'supertest';

import { createApp } from '../../src/server/app.js';
import { BookmarkRepository } from '../../src/server/db/bookmark-repository.js';
import { registerBookmarkRoutes } from '../../src/server/routes/bookmarks.js';
import { BookmarkService } from '../../src/server/services/bookmark-service.js';
import type { ReadingState } from '../../src/shared/contracts.js';
import {
  buildBookmarkInput,
  createDeterministicClock,
  createDeterministicUuidFactory,
} from '../fixtures/bookmarks.js';
import {
  createTemporaryDatabase,
  type TemporaryDatabase,
} from '../fixtures/database.js';

const STATES: readonly ReadingState[] = ['untracked', 'to_read', 'read'];

describe('Read Later repository and API behavior', () => {
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

  function createHttpSubject(service: BookmarkService) {
    return createApp({
      registerRoutes: (app) => registerBookmarkRoutes(app, { bookmarkService: service }),
    });
  }

  it.each(
    STATES.flatMap((source) => STATES.map((target) => [source, target] as const)),
  )('supports the %s → %s reading-state transition', (source, target) => {
    fixture = createTemporaryDatabase();
    const service = createSubject(fixture.database);
    const created = service.createBookmark(
      buildBookmarkInput({ readingState: source }),
    );

    const updated = service.updateReadingState(created.id, target);

    expect(updated).toMatchObject({
      id: created.id,
      readingState: target,
      createdAt: created.createdAt,
    });
    expect(updated.updatedAt).not.toBe(created.updatedAt);
    expect(service.getBookmark(created.id)).toEqual(updated);
  });

  it('lists only To Read bookmarks in deterministic newest-first order', () => {
    fixture = createTemporaryDatabase();
    const service = createSubject(fixture.database);
    service.createBookmark(
      buildBookmarkInput({
        url: 'https://example.com/untracked',
        title: 'Untracked',
        tags: [],
        readingState: 'untracked',
      }),
    );
    const olderPending = service.createBookmark(
      buildBookmarkInput({
        url: 'https://example.com/older-pending',
        title: 'Older pending',
        tags: [],
        readingState: 'to_read',
      }),
    );
    service.createBookmark(
      buildBookmarkInput({
        url: 'https://example.com/read',
        title: 'Already read',
        tags: [],
        readingState: 'read',
      }),
    );
    const newerPending = service.createBookmark(
      buildBookmarkInput({
        url: 'https://example.com/newer-pending',
        title: 'Newer pending',
        tags: [],
        readingState: 'to_read',
      }),
    );

    expect(service.listBookmarks({ view: 'read-later' })).toEqual({
      items: [newerPending, olderPending],
      total: 2,
    });
    expect(service.listBookmarks()).toMatchObject({ total: 4 });
  });

  it('PATCHes reading state and returns purposeful empty data after completing the last item', async () => {
    fixture = createTemporaryDatabase();
    const service = createSubject(fixture.database);
    const app = createHttpSubject(service);
    const pending = service.createBookmark(
      buildBookmarkInput({ tags: [], readingState: 'to_read' }),
    );

    const transition = await request(app)
      .patch(`/api/bookmarks/${pending.id}/reading-state`)
      .send({ readingState: 'read' });

    expect(transition.status).toBe(200);
    expect(transition.body).toMatchObject({ id: pending.id, readingState: 'read' });

    const readLater = await request(app).get('/api/bookmarks?view=read-later');
    expect(readLater.status).toBe(200);
    expect(readLater.body).toEqual({ items: [], total: 0 });

    const library = await request(app).get('/api/bookmarks');
    expect(library.status).toBe(200);
    expect(library.body).toMatchObject({
      items: [{ id: pending.id, readingState: 'read' }],
      total: 1,
    });
  });

  it.each([
    ['unknown value', { readingState: 'later' }],
    ['null value', { readingState: null }],
    ['missing value', {}],
    ['unknown property', { readingState: 'read', unexpected: true }],
  ])('rejects an invalid reading-state request with 422 (%s)', async (_label, body) => {
    fixture = createTemporaryDatabase();
    const service = createSubject(fixture.database);
    const app = createHttpSubject(service);
    const pending = service.createBookmark(
      buildBookmarkInput({ tags: [], readingState: 'to_read' }),
    );

    const response = await request(app)
      .patch(`/api/bookmarks/${pending.id}/reading-state`)
      .send(body);

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
        fieldErrors: expect.any(Object),
      },
    });
    expect(service.getBookmark(pending.id).readingState).toBe('to_read');
  });

  it('persists a reading-state transition and Read Later membership after reopening SQLite', () => {
    fixture = createTemporaryDatabase();
    const service = createSubject(fixture.database);
    const bookmark = service.createBookmark(
      buildBookmarkInput({ tags: [], readingState: 'untracked' }),
    );
    const queued = service.updateReadingState(bookmark.id, 'to_read');
    fixture.database.close();

    const reopened = fixture.openConnection();
    const reopenedService = createSubject(reopened, 100);

    expect(reopenedService.getBookmark(bookmark.id)).toEqual(queued);
    expect(reopenedService.listBookmarks({ view: 'read-later' })).toEqual({
      items: [queued],
      total: 1,
    });
  });
});

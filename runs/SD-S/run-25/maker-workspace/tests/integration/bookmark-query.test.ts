import request from 'supertest';

import { createApp } from '../../src/server/app.js';
import { BookmarkRepository } from '../../src/server/db/bookmark-repository.js';
import { registerBookmarkRoutes } from '../../src/server/routes/bookmarks.js';
import { BookmarkService } from '../../src/server/services/bookmark-service.js';
import type { Bookmark, BookmarkInput } from '../../src/shared/contracts.js';
import {
  buildBookmarkInput,
  createDeterministicClock,
  createDeterministicUuidFactory,
} from '../fixtures/bookmarks.js';
import {
  createTemporaryDatabase,
  type TemporaryDatabase,
} from '../fixtures/database.js';

describe('bookmark search, filtering, and sorting', () => {
  let fixture: TemporaryDatabase | undefined;

  afterEach(() => {
    fixture?.cleanup();
    fixture = undefined;
  });

  function createSubject(options: {
    now?: () => string;
    uuidStart?: number;
  } = {}): BookmarkService {
    fixture = createTemporaryDatabase();
    const repository = new BookmarkRepository(fixture.database, {
      now: options.now ?? createDeterministicClock(),
      createId: createDeterministicUuidFactory(options.uuidStart ?? 1),
    });
    return new BookmarkService(repository);
  }

  function save(
    service: BookmarkService,
    slug: string,
    overrides: Partial<BookmarkInput> = {},
  ): Bookmark {
    return service.createBookmark(
      buildBookmarkInput({
        url: `https://example.com/${slug}`,
        title: slug,
        description: '',
        tags: [],
        readingState: 'untracked',
        ...overrides,
      }),
    );
  }

  it('searches title, URL, description, and tag display name case-insensitively', () => {
    const service = createSubject();
    const titleMatch = save(service, 'title-record', { title: 'Galactic Atlas' });
    const urlMatch = save(service, 'Needle-Path', { title: 'URL record' });
    const descriptionMatch = save(service, 'description-record', {
      title: 'Description record',
      description: 'Contains a Hidden Phrase for readers.',
    });
    const tagMatch = save(service, 'tag-record', {
      title: 'Tag record',
      tags: ['ResearchNeedle'],
    });
    save(service, 'unrelated', {
      title: 'Unrelated record',
      description: 'Nothing to find here.',
      tags: ['Archive'],
    });

    expect(service.listBookmarks({ query: 'gALACTIC' }).items).toEqual([titleMatch]);
    expect(service.listBookmarks({ query: 'needle-PATH' }).items).toEqual([urlMatch]);
    expect(service.listBookmarks({ query: 'HIDDEN phrase' }).items).toEqual([
      descriptionMatch,
    ]);
    expect(service.listBookmarks({ query: 'researchNEEDLE' }).items).toEqual([
      tagMatch,
    ]);
  });

  it('treats SQL wildcard characters in search text as literal characters', () => {
    const service = createSubject();
    const percent = save(service, 'percent', { title: 'Achieved 100% coverage' });
    save(service, 'plain-percent', { title: 'Achieved 100 percent coverage' });
    const underscore = save(service, 'underscore', { title: 'under_score guide' });
    save(service, 'plain-underscore', { title: 'underXscore guide' });

    expect(service.listBookmarks({ query: '%' })).toEqual({
      items: [percent],
      total: 1,
    });
    expect(service.listBookmarks({ query: '_' })).toEqual({
      items: [underscore],
      total: 1,
    });
  });

  it('requires every repeated tag filter using normalized tag identities', async () => {
    const service = createSubject();
    const both = save(service, 'both', { tags: ['Research', 'TypeScript'] });
    save(service, 'research-only', { tags: ['Research'] });
    save(service, 'typescript-only', { tags: ['TypeScript'] });
    const superset = save(service, 'superset', {
      tags: ['Research', 'TypeScript', 'Frontend'],
    });
    const app = createApp({
      registerRoutes: (instance) =>
        registerBookmarkRoutes(instance, { bookmarkService: service }),
    });

    const response = await request(app).get(
      '/api/bookmarks?tag=research&tag=typescript&sort=oldest',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [both, superset], total: 2 });
  });

  it('sorts newest, oldest, and normalized title with ID tie-breakers', () => {
    const timestamps = [
      '2026-09-26T12:00:01.000Z',
      '2026-09-26T12:00:00.000Z',
      '2026-09-26T12:00:01.000Z',
    ];
    const service = createSubject({ now: () => timestamps.shift()! });
    const first = save(service, 'first', { title: 'Zulu' });
    const second = save(service, 'second', { title: 'Alpha' });
    const third = save(service, 'third', { title: 'alpha' });

    expect(service.listBookmarks({ sort: 'newest' }).items.map(({ id }) => id)).toEqual([
      first.id,
      third.id,
      second.id,
    ]);
    expect(service.listBookmarks({ sort: 'oldest' }).items.map(({ id }) => id)).toEqual([
      second.id,
      first.id,
      third.id,
    ]);
    expect(service.listBookmarks({ sort: 'title' }).items.map(({ id }) => id)).toEqual([
      second.id,
      third.id,
      first.id,
    ]);
  });

  it('returns only current associated tags with display spelling, normalized name, and counts', async () => {
    const service = createSubject();
    save(service, 'first', { tags: ['Research', 'Web'] });
    save(service, 'second', { tags: ['research'] });
    const removable = save(service, 'third', { tags: ['Design'] });
    service.deleteBookmark(removable.id);

    const app = createApp({
      registerRoutes: (instance) => {
        instance.get('/api/tags', (_request, response) => {
          response.json(service.listTags());
        });
      },
    });
    const response = await request(app).get('/api/tags');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [
        { name: 'Research', normalizedName: 'research', bookmarkCount: 2 },
        { name: 'Web', normalizedName: 'web', bookmarkCount: 1 },
      ],
    });
  });

  it('applies search, all tag filters, and sort only within the Read Later scope', () => {
    const service = createSubject();
    const beta = save(service, 'pending-beta', {
      title: 'Beta guide',
      tags: ['Research', 'Guide'],
      readingState: 'to_read',
    });
    const alpha = save(service, 'pending-alpha', {
      title: 'Alpha guide',
      tags: ['Research', 'Guide', 'Frontend'],
      readingState: 'to_read',
    });
    save(service, 'untracked-alpha', {
      title: 'Alpha guide outside queue',
      tags: ['Research', 'Guide'],
      readingState: 'untracked',
    });
    save(service, 'pending-wrong-tag', {
      title: 'Gamma guide',
      tags: ['Guide'],
      readingState: 'to_read',
    });
    save(service, 'pending-wrong-query', {
      title: 'Research notes',
      tags: ['Research'],
      readingState: 'to_read',
    });

    expect(
      service.listBookmarks({
        view: 'read-later',
        query: 'GUIDE',
        tag: ['research'],
        sort: 'title',
      }),
    ).toEqual({ items: [alpha, beta], total: 2 });
  });
});

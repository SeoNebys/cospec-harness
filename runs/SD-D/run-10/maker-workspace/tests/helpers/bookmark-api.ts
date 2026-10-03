import type { FastifyInstance } from 'fastify';
import type { BookmarkDetail } from '../../src/shared/contracts/bookmarks';
import { mutationHeaders } from './test-app';

export type Session = Parameters<typeof mutationHeaders>[0];

export async function createBookmark(
  app: FastifyInstance,
  session: Session,
  overrides: Record<string, unknown> = {},
): Promise<BookmarkDetail> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/bookmarks',
    headers: mutationHeaders(session),
    payload: {
      url: `https://example.com/${crypto.randomUUID()}`,
      title: 'Example bookmark',
      description: 'privacy policy research design',
      noteMarkdown: null,
      tagIds: [],
      newTagNames: [],
      collectionId: null,
      isFavorite: false,
      readingState: 'none',
      ...overrides,
    },
  });
  if (response.statusCode !== 201) throw new Error(response.body);
  return response.json<BookmarkDetail>();
}

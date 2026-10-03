import { createBookmark } from '../helpers/bookmark-api';
import { createTestApp, mutationHeaders, registerTestUser } from '../helpers/test-app';

describe('search API', () => {
  it('supports exact tags, phrases, booleans, filters, and actionable errors', async () => {
    const app = await createTestApp();
    const session = await registerTestUser(app, 'search@example.test');
    const tagResponse = await app.inject({
      method: 'POST',
      url: '/api/tags',
      headers: mutationHeaders(session),
      payload: { name: 'News' },
    });
    const tag = tagResponse.json();
    await createBookmark(app, session, {
      title: 'Climate briefing',
      description: 'A climate policy primer',
      tagIds: [tag.id],
      readingState: 'unread',
    });
    await createBookmark(app, session, { title: 'Privacy basics', description: 'privacy and policy' });
    const exact = await app.inject({
      method: 'GET',
      url: '/api/bookmarks?query=%23news%20AND%20%22climate%20policy%22&reading=unread',
      headers: { cookie: session.cookie },
    });
    expect(exact.statusCode).toBe(200);
    expect(exact.json().page.total).toBe(1);
    const phrase = await app.inject({
      method: 'GET',
      url: '/api/bookmarks?query=%22privacy%20policy%22',
      headers: { cookie: session.cookie },
    });
    expect(phrase.json().page.total).toBe(0);
    const invalid = await app.inject({
      method: 'GET',
      url: '/api/bookmarks?query=privacy%20AND',
      headers: { cookie: session.cookie },
    });
    expect(invalid.statusCode).toBe(422);
    expect(invalid.json()).toMatchObject({
      code: 'invalid_search',
      query: 'privacy AND',
      errors: [{ field: 'query', code: 'missing_operand', start: 8, end: 11 }],
    });
    await app.close();
  });
});

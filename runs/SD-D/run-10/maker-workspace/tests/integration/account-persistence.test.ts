import { buildApp } from '../../src/server/app';
import { createBookmark } from '../helpers/bookmark-api';
import { createTestConfig, registerTestUser } from '../helpers/test-app';

describe('account persistence', () => {
  it('keeps the private library across application restarts and authenticated sessions', async () => {
    const config = createTestConfig();
    const first = await buildApp({ config });
    const session = await registerTestUser(first, 'persistent-library@example.test');
    const bookmark = await createBookmark(first, session, { title: 'Survives restart' });
    await first.close();
    const second = await buildApp({ config });
    const response = await second.inject({
      method: 'GET',
      url: `/api/bookmarks/${bookmark.id}`,
      headers: { cookie: session.cookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().title).toBe('Survives restart');
    await second.close();
  });
});

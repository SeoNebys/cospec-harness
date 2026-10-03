import { buildApp } from '../../src/server/app';
import { openDatabase } from '../../src/server/db/database';
import { createTestConfig, registerTestUser } from '../helpers/test-app';
import { seedBookmarks } from './fixtures';
import { percentile } from './report';

describe('10,000 bookmark search performance', () => {
  it('keeps at least 95% of representative searches within one second', async () => {
    const config = createTestConfig();
    const app = await buildApp({ config });
    const session = await registerTestUser(app, 'search-performance@example.test');
    const database = openDatabase(config.databasePath);
    const userId = database
      .prepare('SELECT id FROM users WHERE email_normalized=?')
      .pluck()
      .get('search-performance@example.test') as number;
    seedBookmarks(database, userId, 10_000);
    database.close();
    const timings: number[] = [];
    for (let index = 0; index < 20; index += 1) {
      const started = performance.now();
      const response = await app.inject({
        method: 'GET',
        url: '/api/bookmarks?query=%22climate%20policy%22&sort=updated&limit=50',
        headers: { cookie: session.cookie },
      });
      timings.push(performance.now() - started);
      expect(response.statusCode).toBe(200);
      expect(response.json().page.total).toBe(1000);
    }
    expect(percentile(timings, 0.95)).toBeLessThan(1000);
    await app.close();
  }, 30_000);
});

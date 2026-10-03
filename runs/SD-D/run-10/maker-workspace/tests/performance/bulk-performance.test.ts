import { buildApp } from '../../src/server/app';
import { openDatabase } from '../../src/server/db/database';
import { createTestConfig, mutationHeaders, registerTestUser } from '../helpers/test-app';
import { seedBookmarks } from './fixtures';

describe('1,000 bookmark bulk accounting', () => {
  it('accounts for every selected bookmark in one bounded operation', async () => {
    const config = createTestConfig();
    const app = await buildApp({ config });
    const session = await registerTestUser(app, 'bulk-performance@example.test');
    const database = openDatabase(config.databasePath);
    const userId = database
      .prepare('SELECT id FROM users WHERE email_normalized=?')
      .pluck()
      .get('bulk-performance@example.test') as number;
    const items = seedBookmarks(database, userId, 1000, 'bulk');
    database.close();
    const started = performance.now();
    const response = await app.inject({
      method: 'POST',
      url: '/api/bookmarks/bulk/execute',
      headers: mutationHeaders(session),
      payload: {
        selection: {
          mode: 'ids',
          items: items.map((item) => ({ id: item.id, expectedVersion: item.version })),
        },
        action: { type: 'reading.set', value: 'unread' },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ selectedCount: 1000, succeededCount: 1000, failedCount: 0 });
    expect(performance.now() - started).toBeLessThan(5000);
    await app.close();
  }, 30_000);
});

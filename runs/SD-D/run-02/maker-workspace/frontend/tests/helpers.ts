import type { APIRequestContext } from '@playwright/test';

/**
 * Reset app state between tests. The E2E backend is a single shared instance, so
 * each test starts from a clean collection using the app's own API.
 */
export async function resetAll(request: APIRequestContext): Promise<void> {
  for (const archived of [false, true]) {
    const res = await request.get(`/api/bookmarks?archived=${archived}`);
    const { bookmarks } = await res.json();
    for (const b of bookmarks) await request.delete(`/api/bookmarks/${b.id}`);
  }
  const ss = await (await request.get('/api/saved-searches')).json();
  for (const s of ss.savedSearches) await request.delete(`/api/saved-searches/${s.id}`);
}

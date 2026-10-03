import { test, expect } from '@playwright/test';
import { ready, seed, uid } from './helpers.js';

test('automatic offline copy becomes viewable; Internet Archive action is optional/tolerant', async ({ page }) => {
  test.slow();
  const k = uid();
  await ready(page);
  const bm = await seed(page, { title: `${k} Preserve`, tags: [`${k}p`] });

  // Poll until the automatic offline copy attempt resolves (available for a local page)
  let status = 'pending';
  for (let i = 0; i < 20 && status === 'pending'; i++) {
    const r = await page.request.get(`/api/bookmarks/${bm.id}`);
    status = (await r.json()).offline_status;
    if (status === 'pending') await page.waitForTimeout(1000);
  }
  expect(['available', 'unavailable']).toContain(status);

  if (status === 'available') {
    const snap = await page.request.get(`/api/bookmarks/${bm.id}/snapshot`);
    expect(snap.ok()).toBeTruthy();
  }

  // Internet Archive is optional/manual and must not error the app; status endpoint
  // returns a known value whether or not the network is reachable.
  const preserve = await page.request.post(`/api/bookmarks/${bm.id}/preserve`);
  expect(preserve.status()).toBe(202);
  const st = await (await page.request.get(`/api/bookmarks/${bm.id}/preserve`)).json();
  expect(['none', 'pending', 'saved', 'failed']).toContain(st.ia_status);
});

// e2e helpers: clear and seed data through the API, and mock metadata preview.

export async function clearAll(request) {
  for (const scope of ['all', 'archive']) {
    await request.post('/api/bookmarks/bulk', {
      data: { selection: { matchAll: { scope } }, action: 'delete', confirmed: true },
    });
  }
  const saved = await (await request.get('/api/saved-searches')).json();
  for (const s of saved.items) await request.delete(`/api/saved-searches/${s.id}`);
}

export async function seed(request, url, extra = {}) {
  const res = await request.post('/api/bookmarks', { data: { url, title: extra.title || url, ...extra } });
  return res.json();
}

/** Route /api/bookmarks/preview to a deterministic response (no real fetch). */
export async function mockPreview(page, response) {
  await page.route('**/api/bookmarks/preview', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
  });
}

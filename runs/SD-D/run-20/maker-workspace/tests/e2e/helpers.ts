import type { APIRequestContext } from '@playwright/test';
export async function createBookmark(
  request: APIRequestContext,
  name: string,
  extra: Record<string, unknown> = {},
) {
  const response = await request.post('/api/bookmarks', {
    data: { url: `https://example.com/${name}`, title: name, ...extra },
  });
  if (!response.ok()) throw new Error(await response.text());
  return response.json() as Promise<{ id: string }>;
}
export async function removeBookmark(request: APIRequestContext, id: string) {
  await request.post('/api/bookmarks/bulk-actions', { data: { bookmarkIds: [id], action: 'archive' } });
  await request.post('/api/bookmarks/bulk-actions', {
    data: { bookmarkIds: [id], action: 'delete', confirmed: true },
  });
}

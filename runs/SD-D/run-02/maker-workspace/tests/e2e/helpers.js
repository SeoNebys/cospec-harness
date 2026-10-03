// E2E helpers: seed bookmarks directly via the API for fast, deterministic setup.
export async function seedBookmark(request, body) {
  const res = await request.post('/api/bookmarks', { data: body });
  const json = await res.json();
  return json.bookmark;
}

export async function setPref(request, patch) {
  await request.patch('/api/preferences', { data: patch });
}

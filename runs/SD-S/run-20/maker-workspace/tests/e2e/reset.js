// Clears all bookmarks through the public API so each E2E test starts clean.
// The test server runs with an in-memory database, so this only affects tests.
export async function clearAllBookmarks(request, baseURL) {
  const res = await request.get(`${baseURL}/api/bookmarks`);
  const { bookmarks } = await res.json();
  for (const b of bookmarks) {
    await request.delete(`${baseURL}/api/bookmarks/${b.id}`);
  }
}

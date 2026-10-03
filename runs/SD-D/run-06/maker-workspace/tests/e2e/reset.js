// Reset app state so each e2e spec is independent of the others (they share one
// server/DB within a Playwright run).
export async function resetApp(request) {
  // Delete every bookmark in both the normal and archive views.
  for (const view of ['all', 'unread', 'archive']) {
    await request.post('/api/bookmarks/bulk', {
      data: { selection: { matchView: view }, action: 'delete', confirm: true },
    });
  }
  // Remove saved views.
  const views = await (await request.get('/api/views')).json();
  for (const v of views.views) await request.delete(`/api/views/${v.id}`);
  // Reset preferences to defaults.
  await request.put('/api/preferences', {
    data: { defaultSort: 'newest', itemsPerView: 25, textSize: 'medium' },
  });
}

// Best-effort Internet Archive "Save Page Now" request (FR-024, FR-025).
// Never throws to the caller; returns a status the route can persist.
export async function requestSnapshot(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const saveUrl = `https://web.archive.org/save/${url}`;
    const res = await fetch(saveUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'BookmarkManager/1.0' },
    });
    clearTimeout(timer);

    // The Wayback response location / content-location carries the snapshot path.
    const loc =
      res.headers.get('content-location') ||
      res.headers.get('location') ||
      (res.url && res.url.includes('/web/') ? new URL(res.url).pathname : null);
    if (loc) {
      const snapshotUrl = loc.startsWith('http') ? loc : `https://web.archive.org${loc}`;
      return { status: 'ready', snapshotUrl };
    }
    // Accepted but snapshot URL not yet known.
    if (res.ok) return { status: 'pending', snapshotUrl: null };
    return { status: 'failed', snapshotUrl: null };
  } catch {
    return { status: 'failed', snapshotUrl: null };
  }
}

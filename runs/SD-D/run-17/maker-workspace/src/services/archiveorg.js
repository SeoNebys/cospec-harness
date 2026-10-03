// Internet Archive "Save Page Now" submission (FR-022).
// Best-effort external call; throws on failure so the route reports it
// without harming the bookmark.
const TIMEOUT = 20000;

export async function submitToArchive(url) {
  const saveUrl = 'https://web.archive.org/save/' + url;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(saveUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (BookmarkManager)' },
    });
    // Prefer the content-location header if present, else the final URL,
    // else construct the canonical snapshot URL.
    const contentLocation = res.headers.get('content-location');
    if (contentLocation) return 'https://web.archive.org' + contentLocation;
    if (res.url && res.url.includes('/web/')) return res.url;
    return 'https://web.archive.org/web/*/' + url;
  } finally {
    clearTimeout(t);
  }
}

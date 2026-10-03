// Internet Archive "Save Page Now" (research Decision 7, FR-030).
// Best-effort: returns the archived URL, or throws if unreachable.

export async function preserveInWebArchive(url, { fetchImpl = globalThis.fetch } = {}) {
  const endpoint = `https://web.archive.org/save/${url}`;
  const res = await fetchImpl(endpoint, {
    method: 'GET',
    redirect: 'follow',
    headers: { 'User-Agent': 'BookmarkManager/1.0' },
  });
  if (!res || !res.ok) {
    throw new Error('Internet Archive unavailable');
  }
  // Prefer the Content-Location / Location header if present, else derive.
  const loc =
    res.headers.get?.('content-location') ||
    res.headers.get?.('location') ||
    (res.url && res.url.includes('/web/') ? new URL(res.url).pathname : null);
  if (loc && loc.startsWith('/web/')) {
    return `https://web.archive.org${loc}`;
  }
  if (res.url && res.url.includes('web.archive.org/web/')) {
    return res.url;
  }
  // Fallback: the canonical "latest" snapshot URL.
  return `https://web.archive.org/web/${url}`;
}

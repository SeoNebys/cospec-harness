// T054 [US11]: Internet Archive "Save Page Now" preservation (FR-032).
// Isolated so external failure never touches the bookmark; the route reports it.

const SAVE_BASE = process.env.BM_ARCHIVE_BASE || 'https://web.archive.org/save/';
const TIMEOUT_MS = Number(process.env.BM_ARCHIVE_TIMEOUT_MS) || 20000;

/**
 * Request preservation of a URL. Resolves to the archived URL on success.
 * @throws Error when the Internet Archive is unavailable or refuses.
 */
export async function preserve(url, { fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${SAVE_BASE}${url}`, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'BookmarkManager/0.1 (+local)' },
    });
    if (!res.ok) {
      throw new Error(`Internet Archive returned ${res.status}.`);
    }
    // Prefer the archive's own location header; fall back to a canonical form.
    const loc = res.headers.get('content-location') || res.headers.get('location');
    if (loc) {
      try {
        return new URL(loc, 'https://web.archive.org').toString();
      } catch {
        /* fall through */
      }
    }
    return `https://web.archive.org/web/${timestamp()}/${url}`;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Internet Archive request timed out.');
    }
    throw new Error(err.message || 'Internet Archive is unavailable.');
  } finally {
    clearTimeout(timer);
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
}

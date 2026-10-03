// Internet Archive "Save Page Now" (FR-033/034, R7).
// Submits the URL for archival and returns the archived snapshot URL. Failures
// are recoverable — the caller reports them and leaves the bookmark intact.

export class ArchiveError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ArchiveError';
    this.code = 'archive_unavailable';
  }
}

export async function saveToInternetArchive(url) {
  const endpoint = `https://web.archive.org/save/${url}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'BookmarkManager/1.0 (+local)' },
      signal: controller.signal,
    });
    if (!res.ok && res.status !== 200) {
      throw new ArchiveError(`Internet Archive returned status ${res.status}.`);
    }
    // The archived URL is exposed via the Content-Location header, or derivable
    // from the final response URL.
    const contentLocation = res.headers.get('content-location');
    if (contentLocation) {
      return `https://web.archive.org${contentLocation}`;
    }
    if (res.url && res.url.includes('/web/')) {
      return res.url;
    }
    // Fall back to the "latest" redirector, which resolves to the newest capture.
    return `https://web.archive.org/web/2/${url}`;
  } catch (err) {
    if (err instanceof ArchiveError) throw err;
    throw new ArchiveError(`Could not reach the Internet Archive: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

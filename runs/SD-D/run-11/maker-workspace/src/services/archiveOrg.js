// Optional Internet Archive "Save Page Now" submission (FR-025, FR-026).
// On any failure the caller keeps the bookmark and reports honestly.

const TIMEOUT_MS = 20000;

export class ArchiveUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ArchiveUnavailableError';
    this.code = 'ARCHIVE_UNAVAILABLE';
  }
}

/**
 * Submit a URL to the Internet Archive and return the snapshot URL.
 * Throws ArchiveUnavailableError if the service is unreachable or fails.
 */
export async function saveToInternetArchive(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://web.archive.org/save/${url}`, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'BookmarkManager/1.0 (+local)' },
    });
    if (!res.ok) {
      throw new ArchiveUnavailableError(
        `Internet Archive returned status ${res.status}`
      );
    }
    // The archived snapshot is available at web.archive.org/web/*/<url>;
    // prefer the Content-Location header when present.
    const contentLocation = res.headers.get('content-location');
    const snapshot = contentLocation
      ? `https://web.archive.org${contentLocation}`
      : `https://web.archive.org/web/*/${url}`;
    return snapshot;
  } catch (e) {
    if (e instanceof ArchiveUnavailableError) throw e;
    throw new ArchiveUnavailableError(
      `Could not reach the Internet Archive: ${e.message}`
    );
  } finally {
    clearTimeout(timer);
  }
}

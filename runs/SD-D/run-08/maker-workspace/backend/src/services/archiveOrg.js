// Internet Archive "Save Page Now" integration (FR-040, FR-041).
// Best-effort and out-of-band: any failure is caught by the caller and recorded as
// 'failed' so it is visibly surfaced, never blocking the local save.

const SAVE_ENDPOINT = 'https://web.archive.org/save/';
const TIMEOUT_MS = 30000;

export async function saveToArchiveOrg(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(SAVE_ENDPOINT + url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'BookmarkManager/1.0' },
    });
    if (!res.ok) {
      throw new Error(`Internet Archive responded ${res.status}`);
    }
    // The archived snapshot URL is exposed via the Content-Location header, or we can
    // construct the "latest" timestamped URL.
    const contentLocation = res.headers.get('content-location');
    const archivedUrl = contentLocation
      ? `https://web.archive.org${contentLocation}`
      : `https://web.archive.org/web/2/${url}`;
    return archivedUrl;
  } finally {
    clearTimeout(timer);
  }
}

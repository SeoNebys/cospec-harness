import { setSystemFields, getById } from '../db/bookmarks.repo.js';

// Submit a URL to the Internet Archive "Save Page Now" endpoint (best-effort,
// async, non-blocking). Records archive_org_url/status (FR-028/FR-029). The
// external service may be unavailable (e.g. offline review env); failures are
// recorded honestly, never hidden, and never block the save.
export async function submitToArchiveOrg(bookmarkId, url) {
  if (!getById(bookmarkId)) return;
  setSystemFields(bookmarkId, { archive_org_status: 'pending' });
  try {
    const saveUrl = `https://web.archive.org/save/${url}`;
    const res = await fetch(saveUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
      headers: { 'User-Agent': 'BookmarkManager/1.0' },
    });
    if (!res.ok) throw new Error(`Archive responded ${res.status}`);

    // Prefer the Content-Location header; otherwise derive from the final URL.
    const contentLocation = res.headers.get('content-location');
    const archivedUrl = contentLocation
      ? `https://web.archive.org${contentLocation}`
      : res.url && res.url.includes('/web/')
        ? res.url
        : `https://web.archive.org/web/${url}`;

    setSystemFields(bookmarkId, {
      archive_org_url: archivedUrl,
      archive_org_status: 'ready',
    });
  } catch {
    if (getById(bookmarkId)) setSystemFields(bookmarkId, { archive_org_status: 'failed' });
  }
}

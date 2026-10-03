'use strict';

// Request that the Internet Archive's Wayback Machine save a URL.
// Returns the archived snapshot URL on success. Graceful on failure.
async function saveToInternetArchive(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const saveUrl = 'https://web.archive.org/save/' + url;
    const res = await fetch(saveUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BookmarkManager/1.0)' }
    });
    // The Wayback "Content-Location" header holds the archived path when present.
    const contentLoc = res.headers.get('content-location');
    if (contentLoc) return { ok: true, archiveUrl: 'https://web.archive.org' + contentLoc };
    if (res.url && /web\.archive\.org\/web\//.test(res.url)) return { ok: true, archiveUrl: res.url };
    // Fall back to the "latest" redirector, which resolves to the newest capture.
    return { ok: true, archiveUrl: 'https://web.archive.org/web/2/' + url };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'Request timed out' : (err.message || 'Failed') };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { saveToInternetArchive };

/*
 * Internet Archive safeguard (SCN-020) — an independent, external preservation
 * alongside the local copy. Submits the URL to the Wayback "Save Page Now"
 * endpoint and records a link to the archived version. Fails gracefully
 * (retryable) when the external service is unavailable.
 *
 * ARCHIVE_BASE env overrides the service base (used by tests with a local stub).
 */
'use strict';

const BASE = process.env.ARCHIVE_BASE || 'https://web.archive.org';
const TIMEOUT = 15000;

// Returns { ok, url, savedAt } or { ok:false, reason }
async function submitToArchive(url) {
  try {
    const resp = await fetch(BASE + '/save/' + url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { 'user-agent': 'BookmarksApp/1.0' }
    });
    // Save Page Now returns 200 (or redirects to the archived capture). Treat a
    // 2xx/3xx as accepted; the canonical "latest" view is /web/<url>.
    if (resp.status >= 200 && resp.status < 400) {
      return { ok: true, url: BASE + '/web/' + url, savedAt: Date.now() };
    }
    return { ok: false, reason: 'http-' + resp.status };
  } catch (e) {
    return { ok: false, reason: e.name === 'TimeoutError' ? 'timeout' : (e.message || 'failed') };
  }
}

// The canonical archived-version link for display (does not require a submit).
function archiveViewUrl(url) { return BASE + '/web/' + url; }

module.exports = { submitToArchive, archiveViewUrl, BASE };

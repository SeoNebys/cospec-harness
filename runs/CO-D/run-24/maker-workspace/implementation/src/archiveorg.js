'use strict';
// Optional per-bookmark Internet Archive copy (SCN-014). Uses the Wayback
// "Save Page Now" endpoint. External service: on failure this throws and the
// caller records a failed state that the client shows and can retry.
const { withScheme } = require('./urls');

const TIMEOUT_MS = Number(process.env.ARCHIVEORG_TIMEOUT_MS || 20000);
const UA = 'Mozilla/5.0 (compatible; BookmarksApp/1.0; +personal)';

async function saveToArchiveOrg(rawUrl) {
  const url = withScheme(rawUrl);
  const res = await fetch('https://web.archive.org/save/' + url, {
    method: 'GET',
    redirect: 'follow',
    headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok && res.status !== 200) throw new Error('Internet Archive HTTP ' + res.status);
  // Prefer the explicit archived location header; fall back to the final URL.
  const loc = res.headers.get('content-location') || res.headers.get('location');
  let archived;
  if (loc && loc.startsWith('/web/')) archived = 'https://web.archive.org' + loc;
  else if (res.url && res.url.includes('/web/')) archived = res.url;
  else archived = 'https://web.archive.org/web/' + new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14) + '/' + url;
  // Drain body to release the socket.
  try { await res.text(); } catch (e) { /* ignore */ }
  return archived;
}

module.exports = { saveToArchiveOrg };

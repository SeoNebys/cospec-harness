/*
 * Preserved copy of a page (SCN-019).
 * - Ordinary page: store a self-contained-ish local HTML copy (the fetched
 *   markup with a <base> so relative links resolve, plus a header noting the
 *   capture). Openable even if the original changes or disappears.
 * - PDF: store the PDF file bytes themselves.
 * Best-effort: on failure the bookmark is still saved, just without a snapshot.
 *
 * The Internet Archive option is separate: we build the archive.org link and
 * (best-effort, fire-and-forget) ask the Wayback Machine to capture the page.
 */
const fs = require('fs');
const path = require('path');

function iaLink(url) { return `https://web.archive.org/web/*/${url}`; }

async function savePageCopy(url, id, snapshotsDir, { timeoutMs = 12000, fetchImpl = fetch } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'BookmarksApp/1.0' } });
    const type = (res.headers.get('content-type') || '').toLowerCase();
    const isPdf = /\.pdf($|\?|#)/i.test(url) || type.includes('application/pdf');

    if (isPdf) {
      const buf = Buffer.from(await res.arrayBuffer());
      const file = path.join(snapshotsDir, `${id}.pdf`);
      fs.writeFileSync(file, buf);
      return { hasSnapshot: true, snapshotType: 'pdf', snapshotFile: path.basename(file) };
    }

    const html = await res.text();
    const captured = new Date().toISOString();
    const banner = `<!-- Preserved copy captured ${captured} from ${url} by BookmarksApp -->\n`;
    const baseTag = `<base href="${url.replace(/"/g, '&quot;')}">`;
    // Insert a <base> at the top of <head> so relative resources resolve to the
    // original site; keep the markup otherwise intact so the page is readable.
    let out;
    if (/<head[^>]*>/i.test(html)) out = html.replace(/<head[^>]*>/i, (m) => m + '\n' + baseTag);
    else out = baseTag + '\n' + html;
    const file = path.join(snapshotsDir, `${id}.html`);
    fs.writeFileSync(file, banner + out);
    return { hasSnapshot: true, snapshotType: 'html', snapshotFile: path.basename(file) };
  } catch (e) {
    return { hasSnapshot: false, reason: e.name === 'AbortError' ? 'timeout' : 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

// Fire-and-forget request to the Wayback Machine to capture the page.
function requestInternetArchive(url, { fetchImpl = fetch } = {}) {
  try {
    fetchImpl(`https://web.archive.org/save/${url}`, { method: 'GET' }).catch(() => {});
  } catch (e) { /* best-effort only */ }
  return iaLink(url);
}

module.exports = { savePageCopy, requestInternetArchive, iaLink };

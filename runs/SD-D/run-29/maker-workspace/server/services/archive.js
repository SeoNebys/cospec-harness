// Optional, manual Internet Archive "Save Page Now" preservation. Distinct from
// the automatic offline copy. Best-effort: failures are reported as status, never
// thrown, and never block saving.
const IA_TIMEOUT_MS = 30000;

// Attempt to preserve a URL. Returns { ia_status, ia_snapshot_url }.
export async function preserveToArchive(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IA_TIMEOUT_MS);
  try {
    const res = await fetch(`https://web.archive.org/save/${encodeURI(url)}`, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'BookmarkManager/1.0 (+preservation)' },
    });
    if (!res.ok) {
      return { ia_status: 'failed', ia_snapshot_url: null };
    }
    // The Save Page Now flow exposes the snapshot via Content-Location or the
    // final resolved URL under /web/.
    const contentLoc = res.headers.get('content-location');
    let snapshot = null;
    if (contentLoc) snapshot = `https://web.archive.org${contentLoc}`;
    else if (res.url && res.url.includes('/web/')) snapshot = res.url;
    else snapshot = `https://web.archive.org/web/2/${url}`;
    return { ia_status: 'saved', ia_snapshot_url: snapshot };
  } catch {
    return { ia_status: 'failed', ia_snapshot_url: null };
  } finally {
    clearTimeout(timer);
  }
}

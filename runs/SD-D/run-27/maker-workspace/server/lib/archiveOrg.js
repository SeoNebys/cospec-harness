// Internet Archive "Save Page Now" submission (spec FR-031/FR-032, research §5).
// Best-effort; returns a snapshot reference or a failure status without throwing.

export async function submitToArchiveOrg(url) {
  const saveUrl = `https://web.archive.org/save/${url}`;
  try {
    const resp = await fetch(saveUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(30000)
    });
    // Archive returns the snapshot location via Content-Location or the final URL.
    const contentLocation = resp.headers.get('content-location');
    let snapshot = null;
    if (contentLocation) {
      snapshot = `https://web.archive.org${contentLocation}`;
    } else if (resp.url && resp.url.includes('/web/')) {
      snapshot = resp.url;
    }
    if (resp.ok && snapshot) {
      return { status: 'ok', archive_org_url: snapshot };
    }
    if (resp.ok) {
      // Submitted but snapshot URL not yet available.
      return { status: 'pending', archive_org_url: `https://web.archive.org/web/*/${url}` };
    }
    return { status: 'failed', archive_org_url: null };
  } catch {
    return { status: 'failed', archive_org_url: null };
  }
}

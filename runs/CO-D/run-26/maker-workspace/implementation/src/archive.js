// Internet Archive submission (SCN-015).
// Submits the page to the Internet Archive's "Save Page Now" endpoint, creating a
// public third-party copy. Returns the public archived URL on success. Network
// failures are reported honestly rather than faked.
const TIMEOUT_MS = 30000;

export async function submitToInternetArchive(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const endpoint = "https://web.archive.org/save/" + url;
    const res = await fetch(endpoint, {
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BookmarksApp/1.0)" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    // The archived snapshot location is exposed via Content-Location or the final URL.
    const loc = res.headers.get("content-location");
    let archivedUrl;
    if (loc) archivedUrl = "https://web.archive.org" + loc;
    else if (/\/web\/\d+\//.test(res.url || "")) archivedUrl = res.url;
    else archivedUrl = "https://web.archive.org/web/*/" + url;
    if (!res.ok && !loc) {
      return { status: "error", at: Date.now(), message: `Internet Archive returned ${res.status}.` };
    }
    return { status: "done", at: Date.now(), url: archivedUrl };
  } catch (e) {
    return { status: "error", at: Date.now(), message: "Could not reach the Internet Archive: " + (e && e.message ? e.message : "network error") };
  } finally {
    clearTimeout(timer);
  }
}

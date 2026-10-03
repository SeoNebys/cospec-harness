// Duplicate matching (SCN-002): two links are the same page when they share
// host + path (+ query), ignoring protocol, a leading "www.", a trailing slash,
// and capitalisation of the host.
export function sameKey(u) {
  try {
    const x = new URL(u);
    const host = x.hostname.toLowerCase().replace(/^www\./, '');
    const path = x.pathname.replace(/\/+$/, '');
    return host + path + x.search;
  } catch {
    return String(u).trim().toLowerCase().replace(/\/+$/, '');
  }
}

export function findExisting(bookmarks, url) {
  const key = sameKey(url);
  return bookmarks.find(b => sameKey(b.url) === key) || null;
}

// Internet Archive submission (SCN-016). A manual, per-bookmark action — never
// automatic on save. Requests a save and returns a public snapshot URL. If the
// save request cannot be made, we still return the public snapshot-listing URL so
// the user has a working link, and report whether the live submission succeeded.

import { normalizeUrl } from './urls.js';

export function snapshotUrl(url) {
  // Wayback "latest snapshot" style URL for the page.
  return 'https://web.archive.org/web/2/' + normalizeUrl(url);
}

export async function submit(rawUrl, { timeoutMs = 8000, fetchImpl = globalThis.fetch } = {}) {
  const url = normalizeUrl(rawUrl);
  let submitted = false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetchImpl('https://web.archive.org/save/' + url, { method: 'GET', signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    submitted = res.ok;
  } catch {
    submitted = false;
  }
  return { submitted, snapshotUrl: snapshotUrl(url) };
}

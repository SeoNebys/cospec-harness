// pageReader.js — "read the page" abstraction (DD-2).
//
// A pure browser app can't fetch arbitrary cross-site pages (CORS), so v1 does a
// best-effort read: a real favicon (via a public favicon service, which works as an
// <img>), a title derived from the address, no description, and no thumbnail (the card
// shows its placeholder tile — SCN-013). This is honest to SCN-014: auto-fill may be
// limited, and the user can always fill in the rest and still save.
//
// PRODUCTION: replace readPage() with a call to a tiny serverless proxy that returns
// OpenGraph/meta title, description, and preview image. The rest of the app is unchanged.

import { hostOf, withScheme } from './store.js';

function titleFromUrl(url) {
  try {
    const u = new URL(withScheme(url));
    const seg = u.pathname.split('/').filter(Boolean).pop();
    if (seg) {
      const words = decodeURIComponent(seg).replace(/[-_]+/g, ' ').replace(/\.[a-z0-9]+$/i, '').trim();
      if (words) return words.replace(/\b\w/g, c => c.toUpperCase());
    }
    const h = hostOf(url);
    return h ? h.split('.')[0].replace(/\b\w/g, c => c.toUpperCase()) : url;
  } catch (e) { return url; }
}

export function faviconFor(url) {
  const h = hostOf(url);
  return h ? 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(h) + '&sz=64' : null;
}

// Returns { title, description, favicon, thumbnail, limited }.
// `limited` = true means auto-fill couldn't reach the page's own metadata.
export function readPage(url) {
  return new Promise(resolve => {
    // Simulate the brief "reading the page…" beat.
    setTimeout(() => {
      resolve({
        title: titleFromUrl(url),
        description: '',
        favicon: faviconFor(url),
        thumbnail: null,
        limited: true
      });
    }, 550);
  });
}

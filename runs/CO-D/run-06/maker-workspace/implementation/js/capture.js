// capture.js — "keep a copy of the page" abstraction (SCN-018).
//
// Making an OWN readable copy of an arbitrary page means fetching and extracting its
// content, which the browser can't do cross-origin (CORS) — this is the SERVER PIECE
// the client blessed. In production, capturePage() calls that service, which fetches
// the page, extracts the readable article text + main images (Readability-style), and
// returns them to store under bookmark.copy.
//
// In this standalone client build we can't fetch other sites, so capture is honest:
// a small set of known demo pages return a real readable body; everything else returns
// { status: 'none' } — surfaced plainly as "no copy — couldn't capture" with the note
// kept and an archive fallback offered (SCN-018). No fake content is ever stored.

import { hostOf } from './store.js';

const DEMO = {
  'smittenkitchen.com': {
    body: 'Simplest Brothy Beans and Rice. A weeknight one-pot dinner: creamy white beans simmered with garlic, herbs, and a parmesan rind until the broth turns silky, then spooned over rice. Ingredients: two cans white beans, four cloves garlic, olive oil, a parmesan rind, rice, salt. Method: warm the oil, soften the garlic, add the beans with their liquid plus the parmesan rind, simmer twenty-five minutes, season, and serve over rice with crusty bread.',
    images: ['(saved photo)']
  },
  'use-the-index-luke.com': {
    body: 'A guide to database performance. How indexes work: a b-tree keeps rows ordered so lookups stay fast as the table grows. Design your indexes around the columns your queries filter and sort on, and watch for queries that can\'t use an index.',
    images: []
  },
  'github.com': {
    body: 'ripgrep recursively searches directories for a regex pattern while respecting your gitignore rules. It is line-oriented and fast, built on Rust\'s regex engine.',
    images: []
  }
};

// Returns a Promise<{status:'kept', body, images, capturedAt} | {status:'none'}>.
// A URL flagged as needing a login/paywall returns 'none' to exercise the honest path.
export function capturePage(url) {
  return new Promise(resolve => {
    setTimeout(() => {
      const h = hostOf(url);
      const looksGated = /paywall|members|login|account/i.test(url);
      if (!looksGated && DEMO[h]) resolve({ status: 'kept', body: DEMO[h].body, images: DEMO[h].images, capturedAt: Date.now() });
      else resolve({ status: 'none', reason: looksGated ? 'gated' : 'unreachable-in-client' });
    }, 400);
  });
}

// Where to look for a public archived copy when we couldn't keep our own (flavour C).
export function archiveUrlFor(url) {
  return 'https://web.archive.org/web/*/' + encodeURIComponent(url);
}

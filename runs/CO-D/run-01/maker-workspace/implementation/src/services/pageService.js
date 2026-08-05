// pageService — the SEAM between the app and the outside world.
//
// Everything that needs a server lives behind this one interface:
//   - reading a page's real title + summary (SCN-001)
//   - capturing the saved copy: readable text for pages, the file for PDFs,
//     or reporting HONESTLY that it couldn't be captured (SCN-009, SCN-010)
//   - later: background link-rot checks, external web-archive backstop (parked)
//
// This file is a client-side STUB that simulates those results so the app is
// fully usable offline from a file. In production, replace fetchMetadata with a
// call to the backend that actually fetches and archives; the rest of the app is
// written against this interface and does not change.

const KNOWN = {
  'en.wikipedia.org/wiki/ancient_rome': {
    title: 'Ancient Rome - Wikipedia',
    summary:
      'The Roman civilization that grew from a city-state on the Italian Peninsula into an empire ruling the Mediterranean world for centuries.',
  },
  'en.wikipedia.org/wiki/roman_empire': {
    title: 'Roman Empire - Wikipedia',
    summary:
      'The post-Republican period of ancient Rome, ruled by emperors from 27 BC across Europe, North Africa and the Near East.',
  },
};

function key(url) {
  try {
    const u = new URL(url);
    return (u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '')).toLowerCase();
  } catch {
    return (url || '').toLowerCase();
  }
}
function host(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Pages the stub pretends it cannot read/copy (login walls etc.) — drives the
// honesty path (SCN-009 capture-failed).
function unreadable(url) {
  return /portal\.|\/members\/|\/login|\/account/i.test(url);
}
function isPdf(url) {
  return /\.pdf($|\?)/i.test(url);
}

/**
 * Look up a page's details and capture status.
 * Returns a Promise of { title, summary, copy } where copy = { kind, dead }.
 * kind: 'text' | 'pdf' | 'none'
 */
export function fetchMetadata(url, { delay = 500 } = {}) {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (isPdf(url)) {
        resolve({
          title: prettyPdfTitle(url),
          summary: 'PDF document',
          copy: { kind: 'pdf', dead: false },
        });
        return;
      }
      if (unreadable(url)) {
        // Honesty: no summary invented, no copy claimed.
        resolve({ title: host(url), summary: '', copy: { kind: 'none', dead: false } });
        return;
      }
      const meta = KNOWN[key(url)];
      if (meta) {
        resolve({ ...meta, copy: { kind: 'text', dead: false } });
        return;
      }
      resolve({
        title: 'Page on ' + host(url),
        summary: '',
        copy: { kind: 'text', dead: false },
      });
    }, delay);
  });
}

function prettyPdfTitle(url) {
  try {
    const f = new URL(url).pathname.split('/').pop() || 'document.pdf';
    return f.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').trim() + ' (PDF)';
  } catch {
    return 'PDF document';
  }
}

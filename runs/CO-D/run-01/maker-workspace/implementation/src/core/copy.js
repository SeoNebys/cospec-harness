// Saved-copy status and the honesty rules around it.
//
// Scenario basis:
//   SCN-009 — a copy is kept automatically; dead originals fall back to the copy
//             with a clear notice and no confirmation gate; NEVER a false promise.
//   SCN-010 — PDFs keep the real file; web pages keep readable text.
//
// This is an "invisible discipline" feature (build-priorities.md): being honest
// when a page could NOT be captured is the whole trust of "don't lose it".
//
// A bookmark's copy state: b.copy = { kind, dead }
//   kind: 'pending' | 'text' | 'pdf' | 'none'   ('none' = capture failed)
//   dead: boolean                                (original no longer reachable)

export function copyState(bookmark) {
  return bookmark.copy || { kind: 'pending', dead: false };
}

/** Is the client genuinely protected (a real offline copy exists)? */
export function isProtected(bookmark) {
  const c = copyState(bookmark);
  return c.kind === 'text' || c.kind === 'pdf';
}

/**
 * What should a plain click on the card do?
 *   'original'      — open the live page
 *   'saved-copy'    — original is gone, fall back to the kept copy
 *   'dead-no-copy'  — original is gone and there is no copy to fall back to
 */
export function clickOpens(bookmark) {
  const c = copyState(bookmark);
  if (c.dead) return isProtected(bookmark) ? 'saved-copy' : 'dead-no-copy';
  return 'original';
}

/** Describe the saved-copy view honestly, never overstating protection. */
export function savedCopyView(bookmark) {
  const c = copyState(bookmark);
  if (c.kind === 'pending') {
    return { state: 'pending', protected: false, canOpenOriginal: true, message: 'Capturing a copy…' };
  }
  if (c.kind === 'none') {
    return {
      state: 'no-copy',
      protected: false,
      canOpenOriginal: true,
      message:
        "We couldn't capture a copy of this page — it may need a login. Your link is saved, but there's no offline copy to fall back on.",
    };
  }
  if (c.dead) {
    return {
      state: c.kind,
      protected: true,
      dead: true,
      canOpenOriginal: false,
      message: 'The original appears to be gone — this is your saved copy, kept from when you bookmarked it.',
    };
  }
  return {
    state: c.kind,
    protected: true,
    dead: false,
    canOpenOriginal: true,
    message:
      c.kind === 'pdf'
        ? 'Kept as the original PDF file — not converted to text.'
        : 'Your saved copy, kept from when you bookmarked it — available even if the original disappears.',
  };
}

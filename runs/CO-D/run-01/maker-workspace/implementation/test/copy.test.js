import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isProtected, clickOpens, savedCopyView } from '../src/core/copy.js';

// SCN-009: a live page with a text copy — click opens the original.
test('live text copy: click opens original, copy is protected', () => {
  const b = { copy: { kind: 'text', dead: false } };
  assert.equal(clickOpens(b), 'original');
  assert.equal(isProtected(b), true);
  const v = savedCopyView(b);
  assert.equal(v.protected, true);
  assert.equal(v.canOpenOriginal, true);
});

// SCN-009: dead original falls back to the saved copy (no gate), original disabled.
test('dead original falls back to the saved copy', () => {
  const b = { copy: { kind: 'text', dead: true } };
  assert.equal(clickOpens(b), 'saved-copy');
  const v = savedCopyView(b);
  assert.equal(v.dead, true);
  assert.equal(v.canOpenOriginal, false);
  assert.match(v.message, /original appears to be gone/i);
});

// SCN-009 (honesty): capture failed — NEVER claims protection.
test('capture failed is reported honestly, never a false promise', () => {
  const b = { copy: { kind: 'none', dead: false } };
  assert.equal(isProtected(b), false);
  const v = savedCopyView(b);
  assert.equal(v.protected, false);
  assert.equal(v.state, 'no-copy');
  assert.match(v.message, /couldn't capture|no offline copy/i);
  // Original still reachable (may just need a login).
  assert.equal(v.canOpenOriginal, true);
});

// SCN-009: dead AND no copy — nothing to fall back to.
test('dead with no copy has nothing to show', () => {
  const b = { copy: { kind: 'none', dead: true } };
  assert.equal(clickOpens(b), 'dead-no-copy');
  assert.equal(isProtected(b), false);
});

// SCN-010: a PDF keeps the real file, presented as a PDF (not text).
test('PDF saved copy is protected and marked as a file', () => {
  const b = { copy: { kind: 'pdf', dead: false } };
  assert.equal(isProtected(b), true);
  const v = savedCopyView(b);
  assert.equal(v.state, 'pdf');
  assert.match(v.message, /PDF file/i);
});

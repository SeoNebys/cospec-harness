import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeNote, toPlainText } from '../../src/services/sanitize.js';

test('keeps allowed formatting tags', () => {
  const out = sanitizeNote('<h3>Title</h3><p><strong>bold</strong> and <em>italic</em></p><ul><li>x</li></ul>');
  assert.match(out, /<h3>/);
  assert.match(out, /<strong>/);
  assert.match(out, /<li>/);
});

test('strips scripts and event handlers (FR-010)', () => {
  const out = sanitizeNote('<p onclick="evil()">hi</p><script>alert(1)</script>');
  assert.doesNotMatch(out, /script/i);
  assert.doesNotMatch(out, /onclick/i);
});

test('strips javascript: links, keeps http links', () => {
  const bad = sanitizeNote('<a href="javascript:alert(1)">x</a>');
  assert.doesNotMatch(bad, /javascript:/i);
  const good = sanitizeNote('<a href="https://example.com">x</a>');
  assert.match(good, /href="https:\/\/example.com"/);
});

test('toPlainText extracts text for indexing', () => {
  assert.equal(toPlainText('<p>Hello <strong>world</strong></p>'), 'Hello world');
});

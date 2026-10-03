import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderNote } from '../../server/notes/render.js';

test('renders simple markdown formatting', () => {
  const html = renderNote('**bold** and *italic*\n\n- item1\n- item2');
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<li>item1<\/li>/);
});

test('strips unsafe markup (raw HTML escaped, unsafe link schemes blocked)', () => {
  const html = renderNote('Hello <script>alert(1)</script> [click](javascript:evil())');
  // Raw HTML is escaped to text, so no live <script> element is produced.
  assert.doesNotMatch(html, /<script>/);
  // No anchor with a javascript: scheme is rendered.
  assert.doesNotMatch(html, /href="javascript:/);
});

test('empty note returns empty string', () => {
  assert.equal(renderNote(''), '');
  assert.equal(renderNote(null), '');
});

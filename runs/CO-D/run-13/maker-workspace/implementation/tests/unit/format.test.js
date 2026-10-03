'use strict';
const test = require('node:test');
const assert = require('node:assert');
const F = require('../../public/lib/format.js');

const DAY = 86400000;

test('whenLabel: relative when recent, dated after a week (SCN-012)', () => {
  const now = Date.parse('2026-09-23T12:00:00Z');
  assert.strictEqual(F.whenLabel(new Date(now - 2 * 3600000).toISOString(), now), '2 h ago');
  const older = new Date(now - 10 * DAY).toISOString();
  assert.match(F.whenLabel(older, now), /^\d{1,2} [A-Z][a-z]{2}$/); // e.g. "13 Sep"
});

test('whenLabel: includes year for a previous year (SCN-012)', () => {
  const now = Date.parse('2026-09-23T12:00:00Z');
  const lastYear = Date.parse('2024-08-14T00:00:00Z');
  assert.strictEqual(F.whenLabel(new Date(lastYear).toISOString(), now), '14 Aug 2024');
});

test('isLongNote threshold (SCN-011)', () => {
  assert.strictEqual(F.isLongNote('short'), false);
  assert.strictEqual(F.isLongNote('x'.repeat(300)), true);
  assert.strictEqual(F.isLongNote('a\nb\nc\nd\ne\nf'), true);
});

test('renderMarkdown: headings, bold, list, link, and escaping (SCN-006)', () => {
  const html = F.renderMarkdown('# Head\n\nSome **bold** and [x](https://e.org)\n- one\n- two');
  assert.match(html, /<h4>Head<\/h4>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<a href="https:\/\/e\.org"[^>]*>x<\/a>/);
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  const safe = F.renderMarkdown('<script>alert(1)</script>');
  assert.ok(safe.indexOf('<script>') < 0);
});

test('highlight wraps matches and escapes (SCN-008)', () => {
  assert.strictEqual(F.highlight('CSS Grid', ['grid']), 'CSS <mark>Grid</mark>');
  assert.ok(F.highlight('<b>', ['x']).indexOf('&lt;b&gt;') >= 0);
});

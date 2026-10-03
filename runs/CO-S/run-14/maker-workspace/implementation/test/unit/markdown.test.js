'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { render } = require('../../src/markdown');

test('renders headings, bold, italic, code, lists, links, quotes (SCN-025)', () => {
  const out = render('## Title\n**b** *i* `c`\n- one\n- two\n\n1. a\n2. b\n\n> quote\n\n[MDN](https://developer.mozilla.org)');
  assert.match(out, /<h2>Title<\/h2>/);
  assert.match(out, /<strong>b<\/strong>/);
  assert.match(out, /<em>i<\/em>/);
  assert.match(out, /<code>c<\/code>/);
  assert.match(out, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(out, /<ol><li>a<\/li><li>b<\/li><\/ol>/);
  assert.match(out, /<blockquote>quote<\/blockquote>/);
  assert.match(out, /<a href="https:\/\/developer\.mozilla\.org"[^>]*>MDN<\/a>/);
});

test('code fences render as pre/code', () => {
  const out = render('```\nline1\nline2\n```');
  assert.match(out, /<pre><code>line1\nline2<\/code><\/pre>/);
});

test('raw HTML is escaped, not executed (SCN-025)', () => {
  const out = render('<img src=x onerror=alert(1)> hello');
  assert.match(out, /&lt;img/);
  assert.ok(!/<img/.test(out));
});

test('non-http links are not turned into anchors', () => {
  const out = render('[x](javascript:alert(1))');
  assert.ok(!/href="javascript/.test(out));
});

test('plain text becomes a paragraph', () => {
  assert.strictEqual(render('just text'), '<p>just text</p>');
});

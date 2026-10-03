import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../src/markdown.js';

test('renders the supported Markdown subset (SCN-019)', () => {
  const html = renderMarkdown('# Title\n\nHi **bold** and *it* and `x`.\n\n> quote\n\n1. one\n2. two\n\n- a\n- b\n\n```\ncode\n```\n\n[src](https://e.com)');
  assert.match(html, /<h3>Title<\/h3>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>it<\/em>/);
  assert.match(html, /<code>x<\/code>/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<ol><li>one<\/li><li>two<\/li><\/ol>/);
  assert.match(html, /<ul><li>a<\/li><li>b<\/li><\/ul>/);
  assert.match(html, /<pre><code>code<\/code><\/pre>/);
  assert.match(html, /<a href="https:\/\/e\.com"[^>]*>src<\/a>/);
});

test('escapes raw HTML and non-http links (SCN-019 safe rendering)', () => {
  const html = renderMarkdown('<script>alert(1)</script>\n\n[x](javascript:evil)');
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /href="javascript:/);
});

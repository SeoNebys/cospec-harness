import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../../src/markdown.js';

test('renders headings, bold, lists and links (SCN-009)', () => {
  const html = renderMarkdown('## Title\n**bold** and *em*\n- one\n- two\n[link](https://example.com)');
  assert.match(html, /<h4>Title<\/h4>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>em<\/em>/);
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(html, /<a href="https:\/\/example.com"[^>]*>link<\/a>/);
});

test('escapes raw HTML/script — not executed (SCN-009)', () => {
  const html = renderMarkdown('<img src=x onerror=alert(1)> <b>raw</b>');
  assert.ok(!/<img/i.test(html));
  assert.match(html, /&lt;img/);
});

test('rejects javascript: links', () => {
  const html = renderMarkdown('[x](javascript:alert(1))');
  assert.ok(!/href="javascript:/i.test(html));
});

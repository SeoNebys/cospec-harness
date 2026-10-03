import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../../src/lib/markdown.js';

test('renders basic Markdown', () => {
  const html = renderMarkdown('**bold** and *italic*');
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
});

test('renders lists', () => {
  const html = renderMarkdown('- one\n- two');
  assert.match(html, /<ul>/);
  assert.match(html, /<li>one<\/li>/);
});

test('strips script / dangerous HTML (sanitised)', () => {
  const html = renderMarkdown('hello <script>alert(1)</script> world');
  assert.ok(!/<script>/i.test(html));
});

test('empty note renders empty string', () => {
  assert.equal(renderMarkdown(''), '');
  assert.equal(renderMarkdown(null), '');
});

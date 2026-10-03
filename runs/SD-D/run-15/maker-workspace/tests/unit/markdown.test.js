// T028 [US4]: note Markdown renders allowed formatting and strips dangerous HTML.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderNote } from '../../src/server/services/markdown.js';

test('renders bold, italics, lists, and links', () => {
  const html = renderNote('**bold** and *italic*\n\n- one\n- two\n\n[link](https://example.com)');
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<li>one<\/li>/);
  assert.match(html, /<a [^>]*href="https:\/\/example\.com"/);
});

test('strips <script> and event handlers (stored-XSS defense)', () => {
  const html = renderNote('hi <script>alert(1)</script> <img src=x onerror=alert(1)>');
  assert.doesNotMatch(html, /<script>/i);
  assert.doesNotMatch(html, /onerror/i);
  assert.doesNotMatch(html, /<img/i);
});

test('links get rel/target hardening', () => {
  const html = renderNote('[x](https://e.com)');
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /target="_blank"/);
});

test('javascript: URLs are dropped', () => {
  const html = renderNote('[bad](javascript:alert(1))');
  assert.doesNotMatch(html, /javascript:/i);
});

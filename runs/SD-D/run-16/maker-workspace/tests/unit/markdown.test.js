import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderNote } from '../../src/server/services/markdown.js';

test('renders common Markdown to formatted HTML', () => {
  const html = renderNote('# Title\n\n**bold** and *italic*\n\n- one\n- two\n\n[link](https://example.com)');
  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<li>one<\/li>/);
  assert.match(html, /<a href="https:\/\/example\.com">link<\/a>/);
});

test('strips unsafe HTML (scripts / event handlers / javascript: urls)', () => {
  const html = renderNote('<script>alert(1)</script>\n\n[x](javascript:alert(1))\n\n<img src=x onerror=alert(1)>');
  assert.doesNotMatch(html, /<script>/i);
  assert.doesNotMatch(html, /onerror/i);
  assert.doesNotMatch(html, /javascript:/i);
});

test('empty note renders empty string', () => {
  assert.equal(renderNote(''), '');
  assert.equal(renderNote(null), '');
});

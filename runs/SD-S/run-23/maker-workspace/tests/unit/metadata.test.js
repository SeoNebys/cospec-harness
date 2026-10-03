import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMetadata } from '../../src/metadata.js';

test('prefers Open Graph title, falls back to <title>', () => {
  const og = parseMetadata(
    '<html><head><meta property="og:title" content="OG Title"><title>Doc Title</title></head></html>',
    'https://example.com'
  );
  assert.equal(og.title, 'OG Title');

  const plain = parseMetadata(
    '<html><head><title>Doc Title</title></head></html>',
    'https://example.com'
  );
  assert.equal(plain.title, 'Doc Title');
});

test('reads description from og then meta description', () => {
  const og = parseMetadata(
    '<meta property="og:description" content="OG desc">',
    'https://example.com'
  );
  assert.equal(og.description, 'OG desc');

  const meta = parseMetadata(
    '<meta name="description" content="Meta desc">',
    'https://example.com'
  );
  assert.equal(meta.description, 'Meta desc');
});

test('resolves relative favicon to absolute URL', () => {
  const r = parseMetadata(
    '<link rel="icon" href="/assets/fav.png">',
    'https://example.com/page'
  );
  assert.equal(r.faviconUrl, 'https://example.com/assets/fav.png');
});

test('falls back to /favicon.ico when no icon link', () => {
  const r = parseMetadata('<html><head></head></html>', 'https://example.com/page');
  assert.equal(r.faviconUrl, 'https://example.com/favicon.ico');
});

test('missing title/description yield empty strings', () => {
  const r = parseMetadata('<html><head></head></html>', 'https://example.com');
  assert.equal(r.title, '');
  assert.equal(r.description, '');
});

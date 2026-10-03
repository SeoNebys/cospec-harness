import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMeta } from '../src/metadata.js';

test('extracts title, description, and og:image for auto-fill (SCN-001)', () => {
  const html = `<html><head>
    <title>Serious Eats: Recipes</title>
    <meta name="description" content="Tested recipes and technique.">
    <meta property="og:image" content="/img/hero.jpg">
  </head><body></body></html>`;
  const meta = parseMeta(html, 'https://www.seriouseats.com/article');
  assert.equal(meta.title, 'Serious Eats: Recipes');
  assert.equal(meta.description, 'Tested recipes and technique.');
  assert.equal(meta.image, 'https://www.seriouseats.com/img/hero.jpg'); // resolved to absolute
});

test('prefers Open Graph title/description when present (SCN-001)', () => {
  const html = `<title>fallback</title>
    <meta property="og:title" content="OG Title">
    <meta property="og:description" content="OG description">`;
  const meta = parseMeta(html, 'https://example.com');
  assert.equal(meta.title, 'OG Title');
  assert.equal(meta.description, 'OG description');
});

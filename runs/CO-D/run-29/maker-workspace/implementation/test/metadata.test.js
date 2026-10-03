import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPageDetails } from '../lib/metadata.js';

test('page details prefer social metadata and resolve relative assets', () => {
  const html = `<!doctype html><html><head>
    <title>Fallback title</title>
    <meta property="og:title" content="A Perfect Day in Rome">
    <meta property="og:description" content="A local-inspired itinerary &amp; guide.">
    <meta property="og:site_name" content="AFAR">
    <meta property="og:image" content="/images/rome.jpg">
    <link rel="icon" href="/favicon.png">
  </head></html>`;
  assert.deepEqual(extractPageDetails(html, 'https://afar.com/story'), {
    title: 'A Perfect Day in Rome',
    description: 'A local-inspired itinerary & guide.',
    siteName: 'AFAR',
    previewUrl: 'https://afar.com/images/rome.jpg',
    iconUrl: 'https://afar.com/favicon.png'
  });
});

test('missing optional metadata receives safe fallbacks', () => {
  const result = extractPageDetails('<html><head><title>Plain page</title></head></html>', 'https://example.com/path');
  assert.equal(result.title, 'Plain page');
  assert.equal(result.description, '');
  assert.equal(result.previewUrl, null);
  assert.equal(result.siteName, 'example.com');
  assert.equal(result.iconUrl, 'https://example.com/favicon.ico');
});

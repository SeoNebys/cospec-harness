import test from 'node:test';
import assert from 'node:assert/strict';
import { collectMetadata, parseMetadata } from '../lib/metadata.mjs';

test('SCN-001 extracts useful page metadata and resolves relative images', () => {
  const html = `<!doctype html><html><head><title>Plain title</title><meta property="og:title" content="Useful &amp; clear"><meta name="description" content="A short description"><meta property="og:site_name" content="Field Notes"><meta property="og:image" content="/preview.jpg"><link rel="icon" href="/icon.png"></head></html>`;
  assert.deepEqual(parseMetadata(html, 'https://example.com/article'), {
    title: 'Useful & clear', description: 'A short description', siteName: 'Field Notes', imageUrl: 'https://example.com/preview.jpg', iconUrl: 'https://example.com/icon.png'
  });
});

test('SCN-021 reports missing details so the server can save a fallback', async () => {
  const response = { ok: true, url: 'https://example.com/private', headers: new Headers({ 'content-type': 'text/html' }), text: async () => '<html><body>Private</body></html>' };
  await assert.rejects(() => collectMetadata('https://example.com/private', { fetchImpl: async () => response, checkAddress: async () => {} }), /MISSING_DETAILS/);
});

test('metadata collection rejects non-HTML responses', async () => {
  const response = { ok: true, url: 'https://example.com/file.pdf', headers: new Headers({ 'content-type': 'application/pdf' }), text: async () => '' };
  await assert.rejects(() => collectMetadata('https://example.com/file.pdf', { fetchImpl: async () => response, checkAddress: async () => {} }), /UNSUPPORTED_CONTENT/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchPageDetails, fallbackDetails, validateWebAddress } from '../lib/metadata.mjs';

test('validates and normalizes HTTP addresses', () => {
  assert.equal(validateWebAddress('https://example.com/article'), 'https://example.com/article');
  assert.throws(() => validateWebAddress('example.com/article'), /complete web address/);
  assert.throws(() => validateWebAddress('file:///etc/passwd'), /http:\/\/ or https:\/\//);
});

test('extracts Open Graph title and description from a public HTML page', async () => {
  const html = `<!doctype html><html><head><title>Fallback title</title><meta property="og:title" content="A &amp; B"><meta name="description" content="Useful details here"></head></html>`;
  const details = await fetchPageDetails('https://www.example.com/post', {
    lookupImpl: async () => [{ address: '93.184.216.34', family: 4 }],
    fetchImpl: async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } })
  });
  assert.deepEqual(details, { title: 'A & B', description: 'Useful details here', site: 'example.com' });
});

test('blocks private collection destinations', async () => {
  await assert.rejects(
    fetchPageDetails('http://127.0.0.1/private', { fetchImpl: async () => { throw new Error('must not fetch'); } }),
    /Private addresses/
  );
});

test('provides a recognizable fallback from the address', () => {
  assert.deepEqual(fallbackDetails('https://unavailable.example/article'), {
    title: 'unavailable.example/article',
    description: 'We couldn’t load this page’s title or description. The link is still saved.',
    site: 'unavailable.example'
  });
});

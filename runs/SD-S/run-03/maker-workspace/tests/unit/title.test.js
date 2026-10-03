import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractTitle, fetchTitle } from '../../server/lib/title.js';

test('extractTitle pulls the <title> text', () => {
  assert.equal(extractTitle('<html><head><title>Hello World</title></head></html>'), 'Hello World');
});

test('extractTitle decodes basic entities and collapses whitespace', () => {
  assert.equal(extractTitle('<title>Tom &amp;  Jerry\n</title>'), 'Tom & Jerry');
});

test('extractTitle returns null when no title present', () => {
  assert.equal(extractTitle('<html><head></head></html>'), null);
  assert.equal(extractTitle('<title>   </title>'), null);
});

function stubResponse({ ok = true, contentType = 'text/html', body = '' }) {
  return {
    ok,
    headers: { get: (k) => (k.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => body,
    body: null,
  };
}

test('fetchTitle returns extracted title on success', async () => {
  const stub = async () => stubResponse({ body: '<title>Fetched Title</title>' });
  assert.equal(await fetchTitle('https://example.com', stub), 'Fetched Title');
});

test('fetchTitle returns null on non-HTML content type', async () => {
  const stub = async () => stubResponse({ contentType: 'application/pdf', body: '%PDF' });
  assert.equal(await fetchTitle('https://example.com/x.pdf', stub), null);
});

test('fetchTitle returns null on non-ok response', async () => {
  const stub = async () => stubResponse({ ok: false, body: '<title>Nope</title>' });
  assert.equal(await fetchTitle('https://example.com', stub), null);
});

test('fetchTitle returns null when fetch throws (network/timeout)', async () => {
  const stub = async () => {
    throw new Error('network down');
  };
  assert.equal(await fetchTitle('https://example.com', stub), null);
});

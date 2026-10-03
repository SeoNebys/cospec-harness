const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMetadata, fetchMetadata } = require('../src/metadata');

test('parses and decodes page title and description', () => {
  const result = parseMetadata(`<!doctype html><html><head>
    <title>Walking &amp; Focus</title>
    <meta content="A calm &quot;daily&quot; guide." name="description">
  </head></html>`);
  assert.deepEqual(result, { title: 'Walking & Focus', description: 'A calm "daily" guide.' });
});

test('accepts Open Graph details when ordinary details are absent', () => {
  const result = parseMetadata('<meta content="Shared title" property="og:title"><meta property="og:description" content="Shared summary">');
  assert.deepEqual(result, { title: 'Shared title', description: 'Shared summary' });
});

test('fetches HTML metadata', async () => {
  const fetchImpl = async () => new Response('<title>Example page</title><meta name="description" content="Useful example">', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
  assert.deepEqual(await fetchMetadata('https://example.com', { fetchImpl }), { title: 'Example page', description: 'Useful example' });
});

test('reports a recoverable unavailable-details error', async () => {
  const fetchImpl = async () => new Response('not found', { status: 404, headers: { 'content-type': 'text/html' } });
  await assert.rejects(() => fetchMetadata('https://example.com/missing', { fetchImpl }), (error) => error.code === 'DETAILS_UNAVAILABLE');
});

test('rejects non-web addresses before fetching', async () => {
  await assert.rejects(() => fetchMetadata('bookmark'), (error) => error.code === 'INVALID_URL');
  await assert.rejects(() => fetchMetadata('ftp://example.com'), (error) => error.code === 'INVALID_URL');
});

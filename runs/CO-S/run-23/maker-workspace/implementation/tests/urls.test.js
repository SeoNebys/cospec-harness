const test = require('node:test');
const assert = require('node:assert/strict');
const { canonicalizeAddress, parseWebAddress } = require('../src/urls');
const { extractMetadata } = require('../src/metadata');
const { uniqueTags } = require('../src/store');

test('canonical addresses ignore fragments and common tracking values', () => {
  const original = canonicalizeAddress('https://Example.com/article/?b=2&a=1');
  const variation = canonicalizeAddress('https://example.com/article?utm_source=letter&a=1&b=2#part-three');
  assert.equal(original, variation);
});

test('web addresses require http or https', () => {
  assert.throws(() => parseWebAddress('not a web address'), /complete web address/);
  assert.throws(() => parseWebAddress('ftp://example.com/file'), /complete web address/);
  assert.equal(parseWebAddress('https://example.com').hostname, 'example.com');
});

test('metadata extraction prefers social title and decodes text', () => {
  const metadata = extractMetadata(`
    <html><head>
      <title>Fallback title</title>
      <meta property="og:title" content="A calmer &amp; clearer title">
      <meta name="description" content="A practical &quot;guide&quot;.">
    </head></html>
  `, 'https://www.example.com/page');
  assert.deepEqual(metadata, {
    title: 'A calmer & clearer title',
    description: 'A practical "guide".',
    source: 'example.com'
  });
});

test('tags are trimmed and deduplicated without regard to case', () => {
  assert.deepEqual(uniqueTags([' Design ', 'design', 'UX', '', 'ux']), ['Design', 'UX']);
});

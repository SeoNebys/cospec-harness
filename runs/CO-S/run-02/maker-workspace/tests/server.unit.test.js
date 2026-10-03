const test = require('node:test');
const assert = require('node:assert/strict');
const { decodeHtml, metadataFromHtml } = require('../implementation/server');

test('decodeHtml decodes named and numeric entities and normalizes whitespace', () => {
  assert.equal(decodeHtml('  Save &amp; find &#x2197;  '), 'Save & find ↗');
});

test('metadataFromHtml extracts and decodes title and description', () => {
  const result = metadataFromHtml('<title>Guide &amp; Notes</title><meta name="description" content="A useful &quot;page&quot;">', 'https://example.com/article');
  assert.deepEqual(result, { title: 'Guide & Notes', description: 'A useful "page"', unavailable: false });
});

test('metadataFromHtml falls back to the hostname when title is absent', () => {
  const result = metadataFromHtml('<html><body>No metadata</body></html>', 'https://www.example.com/article');
  assert.deepEqual(result, { title: 'example.com', description: '', unavailable: true });
});

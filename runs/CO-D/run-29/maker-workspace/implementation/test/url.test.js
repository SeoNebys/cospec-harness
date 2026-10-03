import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalAddress, fallbackTitle, prepareAddress } from '../lib/url.js';

test('recognizable shortened addresses receive https', () => {
  assert.deepEqual(prepareAddress('afar.com/story'), { ok: true, address: 'https://afar.com/story' });
});

test('ordinary words are not accepted as an address', () => {
  const result = prepareAddress('rome travel ideas');
  assert.equal(result.ok, false);
  assert.match(result.message, /complete web address/i);
});

test('harmless link clutter has the same canonical address', () => {
  const clean = canonicalAddress('https://afar.com/story');
  const messy = canonicalAddress('https://www.afar.com/story/?utm_source=mail&gclid=123#top');
  assert.equal(messy, clean);
});

test('meaningful address values remain distinct', () => {
  assert.notEqual(
    canonicalAddress('https://afar.com/story'),
    canonicalAddress('https://afar.com/story?edition=weekend')
  );
});

test('fallback titles contain the site and useful path', () => {
  assert.equal(fallbackTitle('https://example.net/field-notes'), 'example.net/field-notes');
});

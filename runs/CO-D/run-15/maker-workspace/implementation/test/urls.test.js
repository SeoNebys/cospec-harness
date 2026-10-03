import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeUrl, parseWebUrl, sameUnderlyingPage } from '../lib/urls.js';

test('SCN-012: obvious marketing parameters do not change bookmark identity', () => {
  assert.equal(
    canonicalizeUrl('https://example.com/story?utm_source=newsletter&fbclid=abc'),
    'https://example.com/story'
  );
  assert.equal(sameUnderlyingPage(
    'https://example.com/story',
    'https://example.com/story?utm_campaign=autumn'
  ), true);
  assert.equal(sameUnderlyingPage(
    'https://example.com/story?chapter=1',
    'https://example.com/story?chapter=2'
  ), false);
});

test('SCN-013: only complete HTTP and HTTPS URLs are accepted', () => {
  assert.throws(() => parseWebUrl('rome pasta'), { code: 'INVALID_URL' });
  assert.throws(() => parseWebUrl('ftp://example.com/file'), { code: 'INVALID_URL' });
  assert.equal(parseWebUrl('https://example.com/page').protocol, 'https:');
});

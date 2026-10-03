import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTitle, fetchTitle } from '../title.js';

test('parseTitle extracts and decodes the <title> (SCN-001)', () => {
  assert.equal(parseTitle('<html><head><title>Hello &amp; Bye</title></head>'), 'Hello & Bye');
  assert.equal(parseTitle('<TITLE>\n  Spaced   Out\n</TITLE>'), 'Spaced Out');
  assert.equal(parseTitle('<title>caf&#233;</title>'), 'café');
  assert.equal(parseTitle('<p>no title here</p>'), '');
});

test('fetchTitle returns the page title on success (SCN-001)', async () => {
  const fake = async () => ({ ok: true, text: async () => '<title>Real Page</title>' });
  assert.equal(await fetchTitle('https://x.com', { fetchImpl: fake }), 'Real Page');
});

test('fetchTitle falls back to the URL when it cannot be read (SCN-009)', async () => {
  const boom = async () => { throw new Error('network down'); };
  assert.equal(await fetchTitle('https://x.com/p', { fetchImpl: boom }), 'https://x.com/p');

  const notOk = async () => ({ ok: false, text: async () => '' });
  assert.equal(await fetchTitle('https://x.com/q', { fetchImpl: notOk }), 'https://x.com/q');

  const noTitle = async () => ({ ok: true, text: async () => '<html>no title</html>' });
  assert.equal(await fetchTitle('https://x.com/r', { fetchImpl: noTitle }), 'https://x.com/r');
});

// Acceptance-style tests for the core spine, each mapped to an approved scenario.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeUrl, toFullUrl, isProbablyUrl, deriveFallbackTitle,
  findDuplicate, addToTop, makeLink,
} from '../extension/src/core.js';
import { parseMetadata } from '../extension/src/metadata.js';

test('SCN-003: duplicate detection ignores protocol, www, trailing slash, case', () => {
  const a = 'https://www.Example.com/Path/';
  const b = 'http://example.com/path';
  assert.equal(normalizeUrl(a), normalizeUrl(b));
  const items = [{ url: 'https://example.com/path' }];
  assert.ok(findDuplicate(items, 'HTTP://WWW.example.com/path/'));
  assert.equal(findDuplicate(items, 'https://example.com/other'), null);
});

test('SCN-001: a saved link is recognisable from fetched metadata', () => {
  const link = makeLink('stripe.com/blog/payment-api',
    { ok: true, title: 'Designing the Stripe Payments API', description: 'Idempotency at scale.' }, 1000);
  assert.equal(link.title, 'Designing the Stripe Payments API');
  assert.equal(link.description, 'Idempotency at scale.');
  assert.equal(link.unreadable, false);
  assert.equal(link.url, 'https://stripe.com/blog/payment-api'); // openable (SCN-002)
  assert.equal(link.norm, 'stripe.com/blog/payment-api');
});

test('SCN-001: newest saved link goes to the top', () => {
  const older = makeLink('a.com', { ok: true, title: 'A' }, 1);
  const newer = makeLink('b.com', { ok: true, title: 'B' }, 2);
  const list = addToTop([older], newer);
  assert.equal(list[0].title, 'B');
  assert.equal(list[1].title, 'A');
});

test('SCN-004: an unreadable page is still saved, with a fallback name', () => {
  const link = makeLink('https://cant-read.example.com/some-page', { ok: false }, 5);
  assert.equal(link.unreadable, true);
  assert.ok(link.title.length > 0);              // never nameless
  assert.equal(link.description, '');
  assert.equal(link.url, 'https://cant-read.example.com/some-page'); // link preserved
});

test('recognisability fallback derives a human-ish name from the URL', () => {
  assert.equal(deriveFallbackTitle('https://seriouseats.com/the-best-pizza-dough'), 'The best pizza dough');
  assert.equal(deriveFallbackTitle('https://example.com'), 'Example');
});

test('SCN-022: non-URL input is rejected, real addresses accepted', () => {
  assert.equal(isProbablyUrl('remember to call the dentist'), false);
  assert.equal(isProbablyUrl('asdf'), false);
  assert.equal(isProbablyUrl('example.com/thing'), true);
  assert.equal(isProbablyUrl('https://stripe.com/blog'), true);
  assert.equal(isProbablyUrl('nytimes.com/2026/travel/kyoto'), true);
});

test('SCN-001: metadata parsing reads title & description (any attribute order)', () => {
  const html = `<html><head>
    <title>36 Hours in Kyoto - The Times</title>
    <meta content="Temples at dawn and quiet streets." name="description">
    <meta property="og:title" content="36 Hours in Kyoto">
  </head></html>`;
  const m = parseMetadata(html);
  assert.equal(m.ok, true);
  assert.equal(m.title, '36 Hours in Kyoto');            // og:title preferred
  assert.equal(m.description, 'Temples at dawn and quiet streets.');
});

test('SCN-004: metadata parsing reports not-readable when there is no title', () => {
  const m = parseMetadata('<html><body>no head, no title</body></html>');
  assert.equal(m.ok, false);
  assert.equal(m.title, '');
});

test('metadata parsing decodes entities and collapses whitespace', () => {
  const m = parseMetadata('<title>Bread &amp;   Butter\n  Basics</title>');
  assert.equal(m.title, 'Bread & Butter Basics');
});

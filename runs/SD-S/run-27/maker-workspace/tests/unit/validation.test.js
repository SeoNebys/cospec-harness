import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAddress,
  normalizeText,
  normalizeTags,
} from '../../src/lib/validation.js';

test('accepts a full https URL', () => {
  const r = normalizeAddress('https://example.com/path');
  assert.equal(r.ok, true);
  assert.equal(r.address, 'https://example.com/path');
});

test('prefixes https:// when scheme missing', () => {
  const r = normalizeAddress('example.com');
  assert.equal(r.ok, true);
  assert.equal(r.address, 'https://example.com/');
});

test('rejects empty and whitespace addresses', () => {
  assert.equal(normalizeAddress('').ok, false);
  assert.equal(normalizeAddress('   ').ok, false);
  assert.equal(normalizeAddress(undefined).ok, false);
});

test('rejects addresses without a dotted host', () => {
  assert.equal(normalizeAddress('notaurl').ok, false);
});

test('rejects non-http schemes', () => {
  assert.equal(normalizeAddress('ftp://example.com').ok, false);
});

test('normalizeText trims and nulls empties', () => {
  assert.equal(normalizeText('  hi  '), 'hi');
  assert.equal(normalizeText('   '), null);
  assert.equal(normalizeText(undefined), null);
});

test('normalizeTags trims, drops empties, dedupes case-insensitively', () => {
  assert.deepEqual(
    normalizeTags(['Web', ' web ', 'reading', '', '  ']),
    ['Web', 'reading']
  );
  assert.deepEqual(normalizeTags('nope'), []);
});

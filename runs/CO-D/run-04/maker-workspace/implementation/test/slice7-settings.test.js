import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTheme, normalizeSize, zoomFor, DEFAULTS } from '../extension/src/settings.js';

test('comfort set is exactly two knobs, with safe defaults', () => {
  assert.equal(DEFAULTS.theme, 'light');
  assert.equal(DEFAULTS.textSize, 'm');
  assert.equal(DEFAULTS.keepCopies, true); // saved copies on by default (SCN-016)
});

test('theme normalises to light unless explicitly dark', () => {
  assert.equal(normalizeTheme('dark'), 'dark');
  assert.equal(normalizeTheme('light'), 'light');
  assert.equal(normalizeTheme('weird'), 'light');
  assert.equal(normalizeTheme(undefined), 'light');
});

test('text size normalises to medium unless a known value', () => {
  assert.equal(normalizeSize('s'), 's');
  assert.equal(normalizeSize('l'), 'l');
  assert.equal(normalizeSize('xl'), 'm');
});

test('text size maps to a sensible zoom', () => {
  assert.ok(zoomFor('s') < 1);
  assert.equal(zoomFor('m'), 1);
  assert.ok(zoomFor('l') > 1);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { hashPassword, verifyPassword, newSessionToken, isValidEmail } = require('../../src/auth');

test('password hash round-trips and is not plain text (NF-2)', () => {
  const h = hashPassword('demo123');
  assert.ok(!h.includes('demo123'));
  assert.ok(verifyPassword('demo123', h));
  assert.ok(!verifyPassword('wrong', h));
});

test('verifyPassword handles malformed stored values', () => {
  assert.ok(!verifyPassword('x', 'garbage'));
  assert.ok(!verifyPassword('x', null));
});

test('session tokens are unique and long', () => {
  const a = newSessionToken(), b = newSessionToken();
  assert.notStrictEqual(a, b);
  assert.ok(a.length >= 32);
});

test('isValidEmail basic validation', () => {
  assert.ok(isValidEmail('you@example.com'));
  assert.ok(!isValidEmail('nope'));
  assert.ok(!isValidEmail('a@b'));
});

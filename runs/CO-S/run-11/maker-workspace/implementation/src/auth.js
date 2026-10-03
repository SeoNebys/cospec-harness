'use strict';

// Account credentials (SCN-013). Passwords are never stored in plain text
// (non-functional NF-2): we store a salted scrypt hash. Sessions are random
// opaque tokens kept server-side (see db.js) and delivered as an httpOnly cookie.

const crypto = require('crypto');

const KEYLEN = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, KEYLEN).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expected] = parts;
  let derived;
  try {
    derived = crypto.scryptSync(password, salt, KEYLEN).toString('hex');
  } catch {
    return false;
  }
  const a = Buffer.from(derived, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function newSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

module.exports = { hashPassword, verifyPassword, newSessionToken, isValidEmail };

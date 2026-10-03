'use strict';
// Simple private sign-in with server-side sessions and an HttpOnly cookie
// (SCN-011). Personal-grade, single account; no team/roles (NF-01).
const crypto = require('node:crypto');
const { db, verifyPassword } = require('./db');

const COOKIE = 'sid';

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions(token,user_id,created_at) VALUES(?,?,?)').run(token, userId, Date.now());
  return token;
}
function deleteSession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(token);
}
function userForToken(token) {
  if (!token) return null;
  const s = db.prepare('SELECT * FROM sessions WHERE token=?').get(token);
  if (!s) return null;
  return db.prepare('SELECT id,email FROM users WHERE id=?').get(s.user_id) || null;
}
function login(email, password) {
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(email || '').trim().toLowerCase());
  if (!u) return null;
  if (!verifyPassword(String(password || ''), u.pass_salt, u.pass_hash)) return null;
  return { id: u.id, email: u.email };
}
function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > -1) out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return out;
}

module.exports = { COOKIE, createSession, deleteSession, userForToken, login, parseCookies };

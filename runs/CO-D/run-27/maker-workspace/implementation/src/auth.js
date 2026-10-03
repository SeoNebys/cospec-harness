// Accounts and sessions. Passwords hashed with scrypt (node:crypto); session id
// in an httpOnly cookie. Not marked Secure so it works over http in the review
// environment; a production deployment would set Secure + a real domain.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import db from "./db.js";

const insUser = db.prepare("INSERT INTO users (id,email,pass_hash,pass_salt,created_at) VALUES (?,?,?,?,?)");
const getUserByEmail = db.prepare("SELECT * FROM users WHERE email = ?");
const getUserById = db.prepare("SELECT * FROM users WHERE id = ?");
const insSession = db.prepare("INSERT INTO sessions (id,user_id,created_at) VALUES (?,?,?)");
const getSession = db.prepare("SELECT * FROM sessions WHERE id = ?");
const delSession = db.prepare("DELETE FROM sessions WHERE id = ?");
const insPrefs = db.prepare("INSERT OR IGNORE INTO prefs (user_id,sort,page_size,text_size) VALUES (?,?,?,?)");

function hash(pw, salt) { return scryptSync(pw, salt, 64).toString("hex"); }

export function createUser(email, password) {
  email = String(email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Please enter a valid email address.");
  if (String(password || "").length < 8) throw new Error("Password must be at least 8 characters.");
  if (getUserByEmail.get(email)) throw new Error("An account with that email already exists.");
  const id = "u" + randomBytes(9).toString("hex");
  const salt = randomBytes(16).toString("hex");
  insUser.run(id, email, hash(password, salt), salt, Date.now());
  insPrefs.run(id, "added-desc", 20, "medium");
  return { id, email };
}

export function verifyUser(email, password) {
  email = String(email || "").trim().toLowerCase();
  const u = getUserByEmail.get(email);
  if (!u) return null;
  const a = Buffer.from(hash(password, u.pass_salt), "hex");
  const b = Buffer.from(u.pass_hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { id: u.id, email: u.email };
}

export function startSession(userId) {
  const id = randomBytes(24).toString("hex");
  insSession.run(id, userId, Date.now());
  return id;
}
export function endSession(sid) { if (sid) delSession.run(sid); }

export function userForSession(sid) {
  if (!sid) return null;
  const s = getSession.get(sid);
  if (!s) return null;
  const u = getUserById.get(s.user_id);
  return u ? { id: u.id, email: u.email } : null;
}

export function ensureUser(email, password) {
  return getUserByEmail.get(String(email).toLowerCase()) ? verifyUser(email, password) : createUser(email, password);
}

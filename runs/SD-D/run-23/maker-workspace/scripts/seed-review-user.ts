import crypto from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { config } from '../src/server/config.js';
import { getDatabase } from '../src/server/db/client.js';

const db = getDatabase();
const now = new Date().toISOString();
const passwordHash = await hash(config.reviewPassword);
db.prepare(`INSERT INTO users(public_id,email,password_hash,created_at,updated_at)
  VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash,updated_at=excluded.updated_at`)
  .run(crypto.randomUUID(), config.reviewEmail, passwordHash, now, now);
console.log(`Review account ready: ${config.reviewEmail}`);

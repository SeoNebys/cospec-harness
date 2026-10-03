import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { loadConfig } from '../../src/server/config/schema.js';
import { openDatabase } from '../../src/server/db/database.js';
import { runMigrations } from '../../src/server/db/migration-runner.js';

const config = loadConfig();
if (config.nodeEnv === 'production') throw new Error('Review seeding is disabled in production.');

const database = openDatabase(config.databasePath);
try {
  runMigrations(database);
  const email = 'review@example.test';
  const exists = database.prepare('SELECT 1 FROM users WHERE email_normalized = ?').get(email);
  if (!exists) {
    const now = Date.now();
    const passwordHash = await argon2.hash('ReviewPassphrase-2026!', {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
    database
      .prepare(
        `INSERT INTO users(public_id, email, email_normalized, password_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(`usr_${randomUUID()}`, email, email, passwordHash, now, now);
    console.log(`Created review account ${email}`);
  } else {
    console.log(`Review account ${email} already exists`);
  }
} finally {
  database.close();
}

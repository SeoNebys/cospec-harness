import { randomUUID } from 'node:crypto';
import type { Database } from '../db/index.js';

export class AuthRepository {
  constructor(private db: Database) {}

  findUserByEmail(email: string) {
    return this.db
      .prepare('SELECT * FROM users WHERE normalized_email = ?')
      .get(email.toLocaleLowerCase()) as Record<string, string> | undefined;
  }

  createUser(email: string, passwordHash: string) {
    const now = new Date().toISOString();
    const user = {
      id: randomUUID(),
      email: email.trim(),
      normalizedEmail: email.trim().toLocaleLowerCase(),
      createdAt: now,
    };
    this.db
      .prepare(
        'INSERT INTO users(id,email,normalized_email,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?)',
      )
      .run(user.id, user.email, user.normalizedEmail, passwordHash, now, now);
    return user;
  }

  createSession(
    userId: string,
    values: {
      id: string;
      digest: string;
      createdAt: string;
      expiresAt: string;
      absoluteExpiresAt: string;
    },
  ) {
    this.db
      .prepare(
        'INSERT INTO sessions(id,user_id,token_digest,created_at,last_seen_at,expires_at,absolute_expires_at) VALUES(?,?,?,?,?,?,?)',
      )
      .run(
        values.id,
        userId,
        values.digest,
        values.createdAt,
        values.createdAt,
        values.expiresAt,
        values.absoluteExpiresAt,
      );
  }

  findSession(digest: string) {
    return this.db
      .prepare(
        `SELECT s.*, u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_digest=? AND s.expires_at>? AND s.absolute_expires_at>?`,
      )
      .get(digest, new Date().toISOString(), new Date().toISOString()) as
      Record<string, string> | undefined;
  }

  deleteSession(digest: string) {
    this.db.prepare('DELETE FROM sessions WHERE token_digest=?').run(digest);
  }
}

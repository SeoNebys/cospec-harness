import type { AppDatabase } from '../db/database.js';

export type UserRow = {
  id: number;
  publicId: string;
  email: string;
  emailNormalized: string;
  passwordHash: string;
  createdAt: number;
  updatedAt: number;
  version: number;
};

export type SessionWithUser = {
  id: number;
  userId: number;
  tokenHash: string;
  csrfSecretHash: string;
  expiresAt: number;
  publicId: string;
  email: string;
};

export class AuthRepository {
  constructor(private readonly database: AppDatabase) {}

  createUser(input: {
    publicId: string;
    email: string;
    emailNormalized: string;
    passwordHash: string;
  }): UserRow {
    const now = Date.now();
    const result = this.database
      .prepare(
        `INSERT INTO users(public_id, email, email_normalized, password_hash, created_at, updated_at)
         VALUES (@publicId, @email, @emailNormalized, @passwordHash, @now, @now)`,
      )
      .run({ ...input, now });
    return this.getUserById(Number(result.lastInsertRowid))!;
  }

  getUserByEmail(emailNormalized: string): UserRow | null {
    return this.mapUser(
      this.database.prepare('SELECT * FROM users WHERE email_normalized = ?').get(emailNormalized),
    );
  }

  getUserById(id: number): UserRow | null {
    return this.mapUser(this.database.prepare('SELECT * FROM users WHERE id = ?').get(id));
  }

  createSession(input: {
    userId: number;
    tokenHash: string;
    csrfSecretHash: string;
    expiresAt: number;
  }): void {
    const now = Date.now();
    this.database
      .prepare(
        `INSERT INTO sessions(user_id, token_hash, csrf_secret_hash, created_at, last_seen_at, expires_at)
         VALUES (@userId, @tokenHash, @csrfSecretHash, @now, @now, @expiresAt)`,
      )
      .run({ ...input, now });
  }

  findSession(tokenHash: string): SessionWithUser | null {
    const row = this.database
      .prepare(
        `SELECT s.id, s.user_id, s.token_hash, s.csrf_secret_hash, s.expires_at,
                u.public_id, u.email
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ?`,
      )
      .get(tokenHash, Date.now()) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as number,
      userId: row.user_id as number,
      tokenHash: row.token_hash as string,
      csrfSecretHash: row.csrf_secret_hash as string,
      expiresAt: row.expires_at as number,
      publicId: row.public_id as string,
      email: row.email as string,
    };
  }

  touchSession(id: number): void {
    this.database.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(Date.now(), id);
  }

  updateSessionCsrf(id: number, csrfSecretHash: string): void {
    this.database
      .prepare('UPDATE sessions SET csrf_secret_hash = ?, last_seen_at = ? WHERE id = ?')
      .run(csrfSecretHash, Date.now(), id);
  }

  revokeSession(tokenHash: string): void {
    this.database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  }

  createResetToken(userId: number, tokenHash: string, expiresAt: number): void {
    this.database
      .prepare(
        `INSERT INTO password_reset_tokens(user_id, token_hash, created_at, expires_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(userId, tokenHash, Date.now(), expiresAt);
  }

  resetPassword(tokenHash: string, passwordHash: string): boolean {
    const transaction = this.database.transaction(() => {
      const token = this.database
        .prepare(
          `SELECT id, user_id FROM password_reset_tokens
           WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?`,
        )
        .get(tokenHash, Date.now()) as { id: number; user_id: number } | undefined;
      if (!token) return false;
      const now = Date.now();
      this.database
        .prepare('UPDATE password_reset_tokens SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL')
        .run(now, token.id);
      this.database
        .prepare('UPDATE users SET password_hash = ?, updated_at = ?, version = version + 1 WHERE id = ?')
        .run(passwordHash, now, token.user_id);
      this.database.prepare('DELETE FROM sessions WHERE user_id = ?').run(token.user_id);
      return true;
    });
    return transaction();
  }

  cleanupExpired(): void {
    const now = Date.now();
    this.database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
    this.database
      .prepare('DELETE FROM password_reset_tokens WHERE expires_at <= ? OR consumed_at IS NOT NULL')
      .run(now);
  }

  private mapUser(value: unknown): UserRow | null {
    const row = value as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as number,
      publicId: row.public_id as string,
      email: row.email as string,
      emailNormalized: row.email_normalized as string,
      passwordHash: row.password_hash as string,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
      version: row.version as number,
    };
  }
}

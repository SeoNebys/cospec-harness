import { randomUUID } from 'node:crypto';
import type { Database } from '../db/database.js';

interface SessionRow { id: string; user_id: string; token_hash: string; created_at: string; last_seen_at: string; expires_at: string }

export class SessionRepository {
  constructor(private db: Database) {}
  create(userId: string, tokenHash: string, expiresAt: string): SessionRow {
    const now = new Date().toISOString();
    const row = { id: randomUUID(), user_id: userId, token_hash: tokenHash, created_at: now, last_seen_at: now, expires_at: expiresAt };
    this.db.prepare('INSERT INTO sessions(id,user_id,token_hash,created_at,last_seen_at,expires_at) VALUES (?,?,?,?,?,?)').run(row.id, row.user_id, row.token_hash, row.created_at, row.last_seen_at, row.expires_at);
    return row;
  }
  findValid(hash: string): SessionRow | undefined {
    return this.db.prepare("SELECT * FROM sessions WHERE token_hash = ? AND julianday(expires_at) > julianday('now')").get(hash) as SessionRow | undefined;
  }
  touch(id: string): void { this.db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(new Date().toISOString(), id); }
  deleteByHash(hash: string): void { this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash); }
  deleteForUser(userId: string): void { this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId); }
  cleanup(): void { this.db.prepare("DELETE FROM sessions WHERE julianday(expires_at) <= julianday('now')").run(); }
}

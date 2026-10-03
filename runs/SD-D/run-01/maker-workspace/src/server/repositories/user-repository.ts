import { randomUUID } from 'node:crypto';
import type { Database } from '../db/database.js';

export interface UserRow { id: string; email: string; email_key: string; password_hash: string; created_at: string }

export class UserRepository {
  constructor(private db: Database) {}
  create(email: string, passwordHash: string): UserRow {
    const row: UserRow = { id: randomUUID(), email: email.trim(), email_key: email.trim().toLocaleLowerCase(), password_hash: passwordHash, created_at: new Date().toISOString() };
    this.db.prepare('INSERT INTO users(id,email,email_key,password_hash,created_at) VALUES (?,?,?,?,?)').run(row.id, row.email, row.email_key, row.password_hash, row.created_at);
    return row;
  }
  byEmail(email: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE email_key = ?').get(email.trim().toLocaleLowerCase()) as UserRow | undefined;
  }
  byId(id: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  }
}

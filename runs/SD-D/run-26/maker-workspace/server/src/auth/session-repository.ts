import type Database from 'better-sqlite3';
export type SessionRow = {
  token_digest: Buffer;
  csrf_digest: Buffer;
  created_at: string;
  last_seen_at: string;
  idle_expires_at: string;
  absolute_expires_at: string;
};
export class SessionRepository {
  constructor(private db: Database.Database) {}
  create(row: SessionRow) {
    this.db
      .prepare(
        `INSERT INTO owner_sessions(token_digest,csrf_digest,created_at,last_seen_at,idle_expires_at,absolute_expires_at) VALUES(@token_digest,@csrf_digest,@created_at,@last_seen_at,@idle_expires_at,@absolute_expires_at)`
      )
      .run(row);
  }
  find(digest: Buffer) {
    return this.db.prepare('SELECT * FROM owner_sessions WHERE token_digest=?').get(digest) as
      | SessionRow
      | undefined;
  }
  touch(digest: Buffer, now: string, idle: string) {
    this.db
      .prepare('UPDATE owner_sessions SET last_seen_at=?, idle_expires_at=? WHERE token_digest=?')
      .run(now, idle, digest);
  }
  revoke(digest: Buffer) {
    this.db.prepare('DELETE FROM owner_sessions WHERE token_digest=?').run(digest);
  }
  purge(now: string) {
    this.db
      .prepare('DELETE FROM owner_sessions WHERE idle_expires_at<=? OR absolute_expires_at<=?')
      .run(now, now);
  }
}

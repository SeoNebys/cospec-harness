import type Database from 'better-sqlite3';
export class ImportRepository {
  constructor(private db: Database.Database) {}
  get(id: string) {
    return this.db.prepare('SELECT * FROM import_batches WHERE id=?').get(id) as any;
  }
  entries(id: string) {
    return this.db
      .prepare('SELECT * FROM import_entries WHERE batch_id=? ORDER BY ordinal')
      .all(id) as any[];
  }
  cancel(id: string) {
    return (
      this.db
        .prepare("UPDATE import_batches SET status='cancelled' WHERE id=? AND status='previewed'")
        .run(id).changes > 0
    );
  }
}

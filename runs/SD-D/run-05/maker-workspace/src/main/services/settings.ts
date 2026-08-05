import type { DB } from '../db/connection'

// Small key–value store for remembered preferences (e.g. the chosen sort order),
// so choices persist to the next visit (FR-032).
export class SettingsService {
  constructor(private readonly db: DB) {}

  get(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string | null }
      | undefined
    return row?.value ?? null
  }

  set(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(key, value)
  }
}

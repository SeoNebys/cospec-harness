import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import type { AppDatabase } from '../db/database.js';

export class MaintenanceService {
  constructor(
    private readonly database: AppDatabase,
    private readonly assetDirectory: string,
  ) {}
  async check(): Promise<{ database: 'ok'; searchIndex: 'ok'; assets: 'ok' }> {
    const quick = this.database.prepare('PRAGMA quick_check').pluck().get();
    if (quick !== 'ok') throw new Error('SQLite quick_check failed');
    const missing =
      (this.database
        .prepare(
          'SELECT COUNT(*) FROM bookmarks b LEFT JOIN bookmark_search s ON s.rowid=b.id WHERE s.rowid IS NULL',
        )
        .pluck()
        .get() as number) ?? 0;
    if (missing) throw new Error(`Search index is missing ${missing} bookmark rows`);
    await access(this.assetDirectory, constants.R_OK | constants.W_OK);
    return { database: 'ok', searchIndex: 'ok', assets: 'ok' };
  }
}

import { createHash, randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { BookmarkRepository } from '../bookmarks/bookmark-repository.js';
import type { BookmarkService } from '../bookmarks/bookmark-service.js';
import type { IconRepository } from '../icons/icon-repository.js';
import { parseBookmarkHtml } from './browser-bookmark-parser.js';
import { AppError } from '@shared/errors.js';
export class ImportService {
  constructor(
    private db: Database.Database,
    private repo: BookmarkRepository,
    private service: BookmarkService,
    private icons?: IconRepository
  ) {}
  preview(html: string, fileName = 'bookmarks.html') {
    if (Buffer.byteLength(html) > 10_000_000)
      throw new AppError(413, 'TOO_LARGE', 'Bookmark files must be 10 MB or smaller.');
    const parsed = parseBookmarkHtml(html),
      id = randomUUID(),
      now = new Date(),
      expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    let fresh = 0,
      duplicate = 0,
      invalid = 0;
    const tx = this.db.transaction(() => {
      const seen = new Set<string>();
      const rows = parsed.entries.map((entry, ordinal) => {
        if ('error' in entry) {
          invalid++;
          return { entry, ordinal, classification: 'invalid', duplicateId: null };
        }
        if (seen.has(entry.url) || this.repo.findByUrl(entry.url)) {
          duplicate++;
          return {
            entry,
            ordinal,
            classification: 'duplicate',
            duplicateId: this.repo.findByUrl(entry.url)?.id ?? null
          };
        }
        seen.add(entry.url);
        fresh++;
        return { entry, ordinal, classification: 'new', duplicateId: null };
      });
      this.db
        .prepare(
          `INSERT INTO import_batches(id,file_name,source_kind,source_version,status,new_count,duplicate_count,invalid_count,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)`
        )
        .run(
          id,
          fileName.slice(0, 255),
          parsed.appExport ? 'bookmark_manager_export' : 'generic_browser_html',
          parsed.appExport ? 1 : null,
          'previewed',
          fresh,
          duplicate,
          invalid,
          now.toISOString(),
          expires.toISOString()
        );
      const insert = this.db.prepare(
        `INSERT INTO import_entries(batch_id,ordinal,classification,reason_code,duplicate_bookmark_id,url,url_key,title,description,note_markdown,tags_json,is_read,archived_at,icon_bytes,icon_mime,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      );
      for (const row of rows) {
        const e = row.entry;
        if ('error' in e)
          insert.run(
            id,
            row.ordinal,
            row.classification,
            e.error,
            null,
            null,
            null,
            null,
            null,
            '',
            '[]',
            0,
            null,
            null,
            null,
            null,
            null
          );
        else
          insert.run(
            id,
            row.ordinal,
            row.classification,
            row.classification === 'duplicate' ? 'exact_url' : null,
            row.duplicateId,
            e.url,
            e.url,
            e.title,
            e.description,
            e.noteMarkdown,
            JSON.stringify(e.tags),
            e.isRead ? 1 : 0,
            e.archivedAt,
            e.icon?.bytes ?? null,
            e.icon
              ? JSON.stringify({ mime: e.icon.mime, width: e.icon.width, height: e.icon.height })
              : null,
            e.createdAt,
            e.updatedAt
          );
      }
    });
    tx();
    return {
      id,
      fileName,
      sourceKind: parsed.appExport ? 'bookmark_manager_export' : 'generic_browser_html',
      status: 'previewed',
      newCount: fresh,
      duplicateCount: duplicate,
      invalidCount: invalid,
      expiresAt: expires.toISOString()
    };
  }
  commit(id: string) {
    const batch = this.db.prepare('SELECT * FROM import_batches WHERE id=?').get(id) as any;
    if (!batch) throw new AppError(404, 'NOT_FOUND', 'Import preview not found.');
    if (batch.status === 'committed') return this.result(batch);
    if (batch.status !== 'previewed')
      throw new AppError(409, 'BAD_REQUEST', 'This import can no longer be confirmed.');
    let imported = 0,
      duplicates = batch.duplicate_count,
      invalid = batch.invalid_count;
    const tx = this.db.transaction(() => {
      this.db.prepare("UPDATE import_batches SET status='committing' WHERE id=?").run(id);
      for (const row of this.db
        .prepare(
          "SELECT * FROM import_entries WHERE batch_id=? AND classification='new' ORDER BY ordinal"
        )
        .all(id) as any[]) {
        if (this.repo.findByUrl(row.url)) {
          duplicates++;
          continue;
        }
        let iconAssetId: string | null = null;
        if (row.icon_bytes && row.icon_mime && this.icons) {
          try {
            const m = JSON.parse(row.icon_mime);
            iconAssetId = this.icons.put({
              hash: createHash('sha256').update(row.icon_bytes).digest('hex'),
              mimeType: m.mime,
              bytes: row.icon_bytes,
              width: m.width,
              height: m.height
            });
          } catch {}
        }
        const made = this.repo.create(
          {
            url: row.url,
            title: row.title,
            description: row.description,
            noteMarkdown: row.note_markdown,
            tags: JSON.parse(row.tags_json),
            isRead: !!row.is_read
          },
          {
            iconAssetId,
            createdAt: validDate(row.created_at),
            updatedAt: validDate(row.updated_at),
            origin: 'import'
          }
        );
        if (row.archived_at)
          this.db
            .prepare('UPDATE bookmarks SET archived_at=? WHERE id=?')
            .run(validDate(row.archived_at), made.id);
        if (!row.title || !row.description)
          this.db
            .prepare(
              `INSERT OR IGNORE INTO metadata_jobs(id,bookmark_id,kind,status,attempt_count,created_at) VALUES(?,?,'import_missing','queued',0,?)`
            )
            .run(randomUUID(), made.id, new Date().toISOString());
        imported++;
      }
      this.db
        .prepare(
          "UPDATE import_batches SET status='committed',new_count=?,duplicate_count=?,committed_at=? WHERE id=?"
        )
        .run(imported, duplicates, new Date().toISOString(), id);
    });
    tx();
    return {
      id,
      status: 'committed',
      importedCount: imported,
      duplicateCount: duplicates,
      invalidCount: invalid
    };
  }
  private result(b: any) {
    return {
      id: b.id,
      status: b.status,
      importedCount: b.new_count,
      duplicateCount: b.duplicate_count,
      invalidCount: b.invalid_count
    };
  }
}
function validDate(value: unknown) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return undefined;
  return new Date(value).toISOString();
}

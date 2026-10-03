import { randomUUID } from 'node:crypto';
import type { DB } from '../db/db.ts';
import { syncFts, removeFts } from '../db/db.ts';
import { deriveTitleFromUrl, normalizeUrl } from '../lib/url.ts';
import { conflict } from '../lib/errors.ts';
import { getBookmarkTags, setBookmarkTags } from './tag.ts';
import type { BookmarkDTO, CaptureStatus } from '../types.ts';

interface BookmarkRow {
  rowid: number;
  id: string;
  url: string;
  url_key: string;
  title_captured: string | null;
  title_user: string | null;
  description_captured: string | null;
  description_user: string | null;
  note_md: string | null;
  favicon_path: string | null;
  preview_image_path: string | null;
  is_unread: number;
  is_archived: number;
  snapshot_path: string | null;
  snapshot_kind: string | null;
  archive_org_url: string | null;
  capture_status: string;
  date_added: string;
  date_modified: string;
}

export interface CreateInput {
  url: string;
  title?: string;
  description?: string;
  note?: string;
  tags?: string[];
  unread?: boolean;
  dateAdded?: string; // used by import to preserve original dates
}

function nowIso(): string {
  return new Date().toISOString();
}

function rowById(db: DB, id: string): BookmarkRow | undefined {
  return db.prepare('SELECT rowid, * FROM bookmark WHERE id = ?').get(id) as
    | BookmarkRow
    | undefined;
}

export function findByKey(db: DB, key: string): BookmarkRow | undefined {
  return db.prepare('SELECT rowid, * FROM bookmark WHERE url_key = ?').get(key) as
    | BookmarkRow
    | undefined;
}

export function serialize(db: DB, row: BookmarkRow): BookmarkDTO {
  let capture: CaptureStatus = {};
  try {
    capture = JSON.parse(row.capture_status || '{}');
  } catch {
    capture = {};
  }
  return {
    id: row.id,
    url: row.url,
    title: row.title_user ?? row.title_captured ?? deriveTitleFromUrl(row.url),
    titleCaptured: row.title_captured,
    titleUser: row.title_user,
    description: row.description_user ?? row.description_captured ?? '',
    descriptionCaptured: row.description_captured,
    descriptionUser: row.description_user,
    note: row.note_md,
    favicon: row.favicon_path,
    previewImage: row.preview_image_path,
    unread: row.is_unread === 1,
    archived: row.is_archived === 1,
    tags: getBookmarkTags(db, row.id),
    snapshotKind: (row.snapshot_kind as 'html' | 'pdf' | null) ?? null,
    hasSnapshot: !!row.snapshot_path,
    archiveOrgUrl: row.archive_org_url,
    captureStatus: capture,
    dateAdded: row.date_added,
    dateModified: row.date_modified,
  };
}

export function getById(db: DB, id: string): BookmarkDTO | null {
  const row = rowById(db, id);
  return row ? serialize(db, row) : null;
}

/**
 * Create a bookmark. Throws a 409 conflict carrying { existingId } when the
 * normalized address already exists (FR-007/FR-008). Tags are linked on create.
 */
export function create(db: DB, input: CreateInput): BookmarkDTO {
  const { url, key } = normalizeUrl(input.url);
  const existing = findByKey(db, key);
  if (existing) {
    throw conflict('A bookmark for this address already exists.', { existingId: existing.id });
  }
  const id = randomUUID();
  const now = nowIso();
  const dateAdded = input.dateAdded ?? now;
  const capture = JSON.stringify({ metadata: 'pending', snapshot: 'pending' });
  const info = db
    .prepare(
      `INSERT INTO bookmark
        (id, url, url_key, title_user, description_user, note_md, is_unread, is_archived,
         capture_status, date_added, date_modified)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    )
    .run(
      id,
      url,
      key,
      input.title?.trim() || null,
      input.description?.trim() || null,
      input.note ?? null,
      input.unread ? 1 : 0,
      capture,
      dateAdded,
      now,
    );
  if (input.tags && input.tags.length) setBookmarkTags(db, id, input.tags);
  syncFts(db, Number(info.lastInsertRowid));
  return serialize(db, rowById(db, id)!);
}

export interface UpdateInput {
  title?: string | null;
  description?: string | null;
  note?: string | null;
  url?: string;
  tags?: string[];
  unread?: boolean;
  archived?: boolean;
}

/** Partial update; re-validates url and re-checks duplicates when url changes. */
export function update(db: DB, id: string, patch: UpdateInput): BookmarkDTO | null {
  const row = rowById(db, id);
  if (!row) return null;

  const sets: string[] = [];
  const params: unknown[] = [];

  if (patch.url !== undefined) {
    const { url, key } = normalizeUrl(patch.url);
    const dup = findByKey(db, key);
    if (dup && dup.id !== id) {
      throw conflict('Another bookmark already uses this address.', { existingId: dup.id });
    }
    sets.push('url = ?', 'url_key = ?');
    params.push(url, key);
  }
  if (patch.title !== undefined) {
    sets.push('title_user = ?');
    params.push(patch.title && patch.title.trim() ? patch.title.trim() : null);
  }
  if (patch.description !== undefined) {
    sets.push('description_user = ?');
    params.push(patch.description && patch.description.trim() ? patch.description.trim() : null);
  }
  if (patch.note !== undefined) {
    sets.push('note_md = ?');
    params.push(patch.note ?? null);
  }
  if (patch.unread !== undefined) {
    sets.push('is_unread = ?');
    params.push(patch.unread ? 1 : 0);
  }
  if (patch.archived !== undefined) {
    sets.push('is_archived = ?');
    params.push(patch.archived ? 1 : 0);
  }

  sets.push('date_modified = ?');
  params.push(nowIso());
  params.push(id);

  db.prepare(`UPDATE bookmark SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  if (patch.tags !== undefined) setBookmarkTags(db, id, patch.tags);

  syncFts(db, row.rowid);
  return serialize(db, rowById(db, id)!);
}

/** Update capture results (metadata/snapshot) from the background worker. */
export function applyCapture(
  db: DB,
  id: string,
  fields: {
    titleCaptured?: string | null;
    descriptionCaptured?: string | null;
    favicon?: string | null;
    previewImage?: string | null;
    snapshotPath?: string | null;
    snapshotKind?: string | null;
    captureStatus: CaptureStatus;
  },
): void {
  const row = rowById(db, id);
  if (!row) return;
  db.prepare(
    `UPDATE bookmark SET
       title_captured = COALESCE(?, title_captured),
       description_captured = COALESCE(?, description_captured),
       favicon_path = COALESCE(?, favicon_path),
       preview_image_path = COALESCE(?, preview_image_path),
       snapshot_path = COALESCE(?, snapshot_path),
       snapshot_kind = COALESCE(?, snapshot_kind),
       capture_status = ?
     WHERE id = ?`,
  ).run(
    fields.titleCaptured ?? null,
    fields.descriptionCaptured ?? null,
    fields.favicon ?? null,
    fields.previewImage ?? null,
    fields.snapshotPath ?? null,
    fields.snapshotKind ?? null,
    JSON.stringify(fields.captureStatus),
    id,
  );
  syncFts(db, row.rowid);
}

export function setArchiveOrgUrl(db: DB, id: string, url: string): void {
  db.prepare('UPDATE bookmark SET archive_org_url = ? WHERE id = ?').run(url, id);
}

export function getSnapshotInfo(
  db: DB,
  id: string,
): { path: string; kind: string } | null {
  const row = db
    .prepare('SELECT snapshot_path, snapshot_kind FROM bookmark WHERE id = ?')
    .get(id) as { snapshot_path: string | null; snapshot_kind: string | null } | undefined;
  if (!row || !row.snapshot_path) return null;
  return { path: row.snapshot_path, kind: row.snapshot_kind ?? 'html' };
}

export function remove(db: DB, id: string): boolean {
  const row = rowById(db, id);
  if (!row) return false;
  removeFts(db, row.rowid);
  db.prepare('DELETE FROM bookmark WHERE id = ?').run(id);
  return true;
}

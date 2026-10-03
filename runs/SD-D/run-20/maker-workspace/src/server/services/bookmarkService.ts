import type { AppDatabase } from '../db/connection.js';
import type { CreateBookmarkInput, UpdateBookmarkInput } from '../../shared/schemas/api.js';
import { extractNoteText, normalizeNoteDocument } from '../../shared/schemas/noteDocument.js';
import { BookmarkRepository } from '../repositories/bookmarkRepository.js';
import { inTransaction, publicId, timestamp } from '../repositories/database.js';
import { MediaRepository } from '../repositories/mediaRepository.js';
import { MetadataPreviewRepository } from '../repositories/metadataPreviewRepository.js';
import { normalizeUrl } from './url.js';

export class BookmarkService {
  private bookmarks: BookmarkRepository;
  private previews: MetadataPreviewRepository;
  private media: MediaRepository;
  constructor(private db: AppDatabase) {
    this.bookmarks = new BookmarkRepository(db);
    this.previews = new MetadataPreviewRepository(db);
    this.media = new MediaRepository(db);
  }
  get(id: string) {
    const row = this.bookmarks.byId(id);
    if (!row) throw Object.assign(new Error('Bookmark not found.'), { statusCode: 404, code: 'NOT_FOUND' });
    return this.bookmarks.toDto(row);
  }
  create(input: CreateBookmarkInput) {
    const normalized = normalizeUrl(input.url);
    const duplicate = this.bookmarks.byNormalizedUrl(normalized.normalizedUrl);
    if (duplicate)
      throw Object.assign(new Error('This address is already saved.'), {
        statusCode: 409,
        code: 'DUPLICATE_BOOKMARK',
        existingBookmarkId: duplicate.public_id,
      });
    const preview = input.metadataPreviewId ? this.previews.byId(input.metadataPreviewId) : undefined;
    const usable =
      preview &&
      preview.normalized_url === normalized.normalizedUrl &&
      preview.expires_at > new Date().toISOString()
        ? preview
        : undefined;
    const note = normalizeNoteDocument(input.noteDocument);
    const now = timestamp();
    return inTransaction(this.db, () => {
      const row = this.bookmarks.insert(
        {
          public_id: publicId(),
          url: normalized.url,
          normalized_url: normalized.normalizedUrl,
          title: input.title?.trim() || usable?.title || normalized.fallbackTitle,
          description: input.description === undefined ? (usable?.description ?? null) : input.description,
          note_document: note ? JSON.stringify(note) : null,
          note_text: extractNoteText(note),
          lifecycle_state: 'active',
          reading_state: input.readingState,
          metadata_status: usable?.status ?? 'fallback',
          icon_asset_id: usable?.icon_asset_id ?? null,
          preview_asset_id: usable?.preview_asset_id ?? null,
          created_at: now,
          updated_at: now,
          archived_at: null,
        },
        input.tagLabels,
      );
      this.media.claim([row.icon_asset_id, row.preview_asset_id]);
      return this.bookmarks.toDto(row);
    });
  }
  update(id: string, input: UpdateBookmarkInput) {
    const current = this.bookmarks.byId(id);
    if (!current)
      throw Object.assign(new Error('Bookmark not found.'), { statusCode: 404, code: 'NOT_FOUND' });
    const changes: Record<string, unknown> = { updated_at: timestamp() };
    if (input.url !== undefined) {
      const normalized = normalizeUrl(input.url);
      const duplicate = this.bookmarks.byNormalizedUrl(normalized.normalizedUrl);
      if (duplicate && duplicate.id !== current.id)
        throw Object.assign(new Error('This address is already saved.'), {
          statusCode: 409,
          code: 'DUPLICATE_BOOKMARK',
        });
      changes.url = normalized.url;
      changes.normalized_url = normalized.normalizedUrl;
      const preview = input.metadataPreviewId ? this.previews.byId(input.metadataPreviewId) : undefined;
      if (
        preview &&
        preview.normalized_url === normalized.normalizedUrl &&
        preview.expires_at > new Date().toISOString()
      ) {
        changes.metadata_status = preview.status;
        changes.icon_asset_id = preview.icon_asset_id;
        changes.preview_asset_id = preview.preview_asset_id;
      } else changes.metadata_status = 'fallback';
    }
    if (input.title !== undefined) changes.title = input.title.trim();
    if (input.description !== undefined) changes.description = input.description;
    if (input.noteDocument !== undefined) {
      const note = normalizeNoteDocument(input.noteDocument);
      changes.note_document = note ? JSON.stringify(note) : null;
      changes.note_text = extractNoteText(note);
    }
    if (input.readingState !== undefined) changes.reading_state = input.readingState;
    if (input.lifecycleState !== undefined && input.lifecycleState !== current.lifecycle_state) {
      changes.lifecycle_state = input.lifecycleState;
      changes.archived_at = input.lifecycleState === 'archived' ? timestamp() : null;
    }
    return inTransaction(this.db, () =>
      this.bookmarks.toDto(this.bookmarks.update(current.id, changes, input.tagLabels)),
    );
  }
}

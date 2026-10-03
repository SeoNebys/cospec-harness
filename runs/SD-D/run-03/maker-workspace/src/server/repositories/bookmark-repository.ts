import type {
  Bookmark,
  BookmarkCreate,
  BookmarkPage,
  MetadataStatus,
  Provenance,
} from "../../shared/contracts/api.js";
import type { AppDatabase } from "../db/database.js";
import { prepareNote } from "../services/notes/note-service.js";
import { SearchRepository } from "./search-repository.js";
import { TagRepository } from "./tag-repository.js";

export interface CreateBookmarkValues {
  input: BookmarkCreate;
  address: string;
  normalizedAddress: string;
  fallbackTitle: string;
  now: string;
}

export interface BookmarkIdentity {
  id: number;
  archived: boolean;
}

export interface BookmarkScopeCounts {
  active: number;
  readLater: number;
  archived: number;
}

export interface MetadataUpdate {
  bookmarkId: number;
  addressRevision: number;
  title?: string;
  description?: string;
  iconHash?: string | null;
  status: MetadataStatus;
  errorCode?: string | null;
  fetchedAt: string;
}

export interface BookmarkRow {
  id: number;
  address: string;
  normalized_address: string;
  address_revision: number;
  title: string;
  title_sort_key: string;
  title_provenance: Provenance;
  retrieved_title_candidate: string | null;
  description: string;
  description_provenance: Provenance;
  retrieved_description_candidate: string | null;
  icon_hash: string | null;
  metadata_status: MetadataStatus;
  metadata_error_code: string | null;
  metadata_fetched_at: string | null;
  note_markdown: string;
  note_plain: string;
  is_favorite: 0 | 1;
  is_unread: 0 | 1;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export class DuplicateBookmarkError extends Error {
  readonly identity: BookmarkIdentity;

  constructor(identity: BookmarkIdentity) {
    super("That address is already saved.");
    this.name = "DuplicateBookmarkError";
    this.identity = identity;
  }
}

export class BookmarkNotFoundError extends Error {
  constructor() {
    super("Bookmark not found.");
    this.name = "BookmarkNotFoundError";
  }
}

export function titleSortKey(title: string): string {
  return title.normalize("NFKC").toLocaleLowerCase("und");
}

function toBookmark(row: BookmarkRow, tags: Bookmark["tags"]): Bookmark {
  return {
    id: row.id,
    address: row.address,
    title: row.title,
    titleProvenance: row.title_provenance,
    retrievedTitleCandidate: row.retrieved_title_candidate,
    description: row.description,
    descriptionProvenance: row.description_provenance,
    retrievedDescriptionCandidate: row.retrieved_description_candidate,
    iconUrl: row.icon_hash ? `/api/bookmarks/${row.id}/icon` : null,
    metadataStatus: row.metadata_status,
    metadataErrorCode: row.metadata_error_code,
    noteMarkdown: row.note_markdown,
    tags,
    favorite: row.is_favorite === 1,
    unread: row.is_unread === 1,
    archived: row.archived_at !== null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowForNormalizedAddress(
  database: AppDatabase,
  normalizedAddress: string,
): BookmarkRow | undefined {
  return database
    .prepare("SELECT * FROM bookmarks WHERE normalized_address = ?")
    .get(normalizedAddress) as BookmarkRow | undefined;
}

export class BookmarkRepository {
  private readonly tags: TagRepository;
  private readonly search: SearchRepository;

  constructor(private readonly database: AppDatabase) {
    this.tags = new TagRepository(database);
    this.search = new SearchRepository(database);
  }

  findIdentityByNormalizedAddress(normalizedAddress: string): BookmarkIdentity | null {
    const row = rowForNormalizedAddress(this.database, normalizedAddress);
    return row ? { id: row.id, archived: row.archived_at !== null } : null;
  }

  create(values: CreateBookmarkValues): Bookmark {
    const existing = this.findIdentityByNormalizedAddress(values.normalizedAddress);
    if (existing) throw new DuplicateBookmarkError(existing);

    const titleWasSupplied = values.input.title !== undefined;
    const descriptionWasSupplied = values.input.description !== undefined;
    const title = titleWasSupplied
      ? values.input.title?.trim() || values.fallbackTitle
      : values.fallbackTitle;
    const description = descriptionWasSupplied ? (values.input.description?.trim() ?? "") : "";
    const note = prepareNote(values.input.noteMarkdown ?? "");

    try {
      const create = this.database.transaction(() => {
        const result = this.database
          .prepare(`
            INSERT INTO bookmarks (
              address, normalized_address, title, title_sort_key, title_provenance,
              description, description_provenance, metadata_status, note_markdown,
              note_plain, is_favorite, is_unread, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
          `)
          .run(
            values.address,
            values.normalizedAddress,
            title,
            titleSortKey(title),
            titleWasSupplied ? "user" : "fallback",
            description,
            descriptionWasSupplied ? "user" : "fallback",
            note.markdown,
            note.plainText,
            values.input.favorite ? 1 : 0,
            values.input.unread ? 1 : 0,
            values.now,
            values.now,
          );
        const id = Number(result.lastInsertRowid);
        this.tags.replaceForBookmark(id, values.input.tags ?? [], values.now);
        this.search.synchronizeBookmark(id);
        return this.get(id);
      });
      return create.immediate();
    } catch (error) {
      const raced = this.findIdentityByNormalizedAddress(values.normalizedAddress);
      if (raced) throw new DuplicateBookmarkError(raced);
      throw error;
    }
  }

  get(id: number): Bookmark {
    const row = this.database.prepare("SELECT * FROM bookmarks WHERE id = ?").get(id) as
      | BookmarkRow
      | undefined;
    if (!row) throw new BookmarkNotFoundError();
    return toBookmark(row, this.tags.listForBookmark(id));
  }

  getRow(id: number): BookmarkRow | null {
    return (
      (this.database.prepare("SELECT * FROM bookmarks WHERE id = ?").get(id) as
        | BookmarkRow
        | undefined) ?? null
    );
  }

  listActive(limit = 50): BookmarkPage {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const rows = this.database
      .prepare(
        "SELECT * FROM bookmarks WHERE archived_at IS NULL ORDER BY created_at DESC, id DESC LIMIT ?",
      )
      .all(safeLimit) as BookmarkRow[];
    const total = (
      this.database
        .prepare("SELECT count(*) AS count FROM bookmarks WHERE archived_at IS NULL")
        .get() as { count: number }
    ).count;
    return {
      items: rows.map((row) => toBookmark(row, this.tags.listForBookmark(row.id))),
      total,
      nextCursor: null,
    };
  }

  /**
   * Changes only reading state and modification time. The conditional update
   * keeps an idempotent request from pretending the bookmark was modified.
   */
  updateReadingState(id: number, unread: boolean, now: string): Bookmark {
    const update = this.database.transaction(() => {
      const result = this.database
        .prepare(`
          UPDATE bookmarks
          SET is_unread = ?, updated_at = ?
          WHERE id = ? AND is_unread <> ?
        `)
        .run(unread ? 1 : 0, now, id, unread ? 1 : 0);

      if (result.changes === 0 && !this.getRow(id)) throw new BookmarkNotFoundError();
      return this.get(id);
    });
    return update();
  }

  /** Counts navigation scopes in one consistent read. */
  scopeCounts(): BookmarkScopeCounts {
    const row = this.database
      .prepare(`
        SELECT
          count(CASE WHEN archived_at IS NULL THEN 1 END) AS active,
          count(CASE WHEN archived_at IS NULL AND is_unread = 1 THEN 1 END) AS readLater,
          count(CASE WHEN archived_at IS NOT NULL THEN 1 END) AS archived
        FROM bookmarks
      `)
      .get() as BookmarkScopeCounts;
    return row;
  }

  applyMetadata(update: MetadataUpdate): boolean {
    const apply = this.database.transaction(() => {
      const row = this.getRow(update.bookmarkId);
      if (!row || row.address_revision !== update.addressRevision) return false;

      const title = update.title?.trim();
      const description = update.description?.trim();
      const titleCanApply = Boolean(title) && row.title_provenance !== "user";
      const descriptionCanApply =
        description !== undefined && row.description_provenance !== "user";

      const result = this.database
        .prepare(`
        UPDATE bookmarks SET
          title = CASE WHEN @titleCanApply THEN @title ELSE title END,
          title_sort_key = CASE WHEN @titleCanApply THEN @titleSortKey ELSE title_sort_key END,
          title_provenance = CASE WHEN @titleCanApply THEN 'retrieved' ELSE title_provenance END,
          retrieved_title_candidate = CASE WHEN @title IS NOT NULL AND title_provenance = 'user' THEN @title ELSE retrieved_title_candidate END,
          description = CASE WHEN @descriptionCanApply THEN @description ELSE description END,
          description_provenance = CASE WHEN @descriptionCanApply THEN 'retrieved' ELSE description_provenance END,
          retrieved_description_candidate = CASE WHEN @description IS NOT NULL AND description_provenance = 'user' THEN @description ELSE retrieved_description_candidate END,
          icon_hash = COALESCE(@iconHash, icon_hash),
          metadata_status = @status,
          metadata_error_code = @errorCode,
          metadata_fetched_at = @fetchedAt,
          updated_at = @fetchedAt
        WHERE id = @bookmarkId AND address_revision = @addressRevision
        `)
        .run({
          bookmarkId: update.bookmarkId,
          addressRevision: update.addressRevision,
          title: title ?? null,
          titleCanApply: titleCanApply ? 1 : 0,
          titleSortKey: title ? titleSortKey(title) : row.title_sort_key,
          description: description ?? null,
          descriptionCanApply: descriptionCanApply ? 1 : 0,
          iconHash: update.iconHash ?? null,
          status: update.status,
          errorCode: update.errorCode ?? null,
          fetchedAt: update.fetchedAt,
        });
      if (result.changes === 1) this.search.synchronizeBookmark(update.bookmarkId);
      return result.changes === 1;
    });
    return apply();
  }

  pendingMetadata(): Array<{ id: number; address: string; addressRevision: number }> {
    return this.database
      .prepare(
        "SELECT id, address, address_revision AS addressRevision FROM bookmarks WHERE metadata_status = 'pending'",
      )
      .all() as Array<{ id: number; address: string; addressRevision: number }>;
  }
}

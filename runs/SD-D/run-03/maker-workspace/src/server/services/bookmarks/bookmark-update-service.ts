import type { Bookmark, BookmarkPatch } from "../../../shared/contracts/api.js";
import { NoteValidationError } from "../../../shared/types/notes.js";
import type { AppDatabase } from "../../db/database.js";
import {
  BookmarkNotFoundError,
  BookmarkRepository,
  DuplicateBookmarkError,
  titleSortKey,
} from "../../repositories/bookmark-repository.js";
import { SearchRepository } from "../../repositories/search-repository.js";
import { TagRepository } from "../../repositories/tag-repository.js";
import { prepareNote } from "../notes/note-service.js";
import { fallbackTitleFromAddress, normalizeAddress } from "./address-normalizer.js";

export class BookmarkTitleValidationError extends Error {
  readonly code = "TITLE_REQUIRED";
  readonly field = "title";

  constructor() {
    super("Enter a title for this bookmark.");
    this.name = "BookmarkTitleValidationError";
  }
}

export interface MetadataRequest {
  bookmarkId: number;
  address: string;
  addressRevision: number;
}

export interface BookmarkUpdateResult {
  bookmark: Bookmark;
  metadataRequest: MetadataRequest | null;
}

export class BookmarkUpdateService {
  private readonly bookmarks: BookmarkRepository;
  private readonly tags: TagRepository;
  private readonly search: SearchRepository;

  constructor(
    private readonly database: AppDatabase,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.bookmarks = new BookmarkRepository(database);
    this.tags = new TagRepository(database);
    this.search = new SearchRepository(database);
  }

  update(bookmarkId: number, patch: BookmarkPatch): BookmarkUpdateResult {
    const preparedAddress = patch.address === undefined ? null : normalizeAddress(patch.address);
    const preparedNote = patch.noteMarkdown === undefined ? null : prepareNote(patch.noteMarkdown);
    const manualTitle = patch.title?.trim();
    if (patch.title !== undefined && manualTitle === "") throw new BookmarkTitleValidationError();
    const now = this.now().toISOString();

    const update = this.database.transaction((): BookmarkUpdateResult => {
      const current = this.bookmarks.getRow(bookmarkId);
      if (!current) throw new BookmarkNotFoundError();

      let address = current.address;
      let normalizedAddress = current.normalized_address;
      let addressRevision = current.address_revision;
      let title = current.title;
      let titleProvenance = current.title_provenance;
      let titleCandidate = current.retrieved_title_candidate;
      let description = current.description;
      let descriptionProvenance = current.description_provenance;
      let descriptionCandidate = current.retrieved_description_candidate;
      let iconHash = current.icon_hash;
      let metadataStatus = current.metadata_status;
      let metadataErrorCode = current.metadata_error_code;
      let metadataFetchedAt = current.metadata_fetched_at;
      let metadataRequest: MetadataRequest | null = null;

      const addressChanged =
        preparedAddress !== null && preparedAddress.address !== current.address;
      if (preparedAddress) {
        const conflict = this.bookmarks.findIdentityByNormalizedAddress(
          preparedAddress.normalizedAddress,
        );
        if (conflict && conflict.id !== bookmarkId) throw new DuplicateBookmarkError(conflict);

        address = preparedAddress.address;
        normalizedAddress = preparedAddress.normalizedAddress;
        if (addressChanged) {
          addressRevision += 1;
          if (titleProvenance !== "user") {
            title = fallbackTitleFromAddress(address);
            titleProvenance = "fallback";
          }
          if (descriptionProvenance !== "user") {
            description = "";
            descriptionProvenance = "fallback";
          }
          titleCandidate = null;
          descriptionCandidate = null;
          iconHash = null;
          metadataStatus = "pending";
          metadataErrorCode = null;
          metadataFetchedAt = null;
          metadataRequest = { bookmarkId, address, addressRevision };
        }
      }

      if (patch.acceptRetrievedTitle === true && titleCandidate !== null) {
        title = titleCandidate;
        titleProvenance = "retrieved";
        titleCandidate = null;
      }
      if (patch.acceptRetrievedDescription === true && descriptionCandidate !== null) {
        description = descriptionCandidate;
        descriptionProvenance = "retrieved";
        descriptionCandidate = null;
      }
      if (patch.title !== undefined) {
        title = manualTitle as string;
        titleProvenance = "user";
      }
      if (patch.description !== undefined) {
        description = patch.description.trim();
        descriptionProvenance = "user";
      }

      const archivedAt =
        patch.archived === true
          ? (current.archived_at ?? now)
          : patch.archived === false
            ? null
            : current.archived_at;

      this.database
        .prepare(`
          UPDATE bookmarks SET
            address = @address,
            normalized_address = @normalizedAddress,
            address_revision = @addressRevision,
            title = @title,
            title_sort_key = @titleSortKey,
            title_provenance = @titleProvenance,
            retrieved_title_candidate = @titleCandidate,
            description = @description,
            description_provenance = @descriptionProvenance,
            retrieved_description_candidate = @descriptionCandidate,
            icon_hash = @iconHash,
            metadata_status = @metadataStatus,
            metadata_error_code = @metadataErrorCode,
            metadata_fetched_at = @metadataFetchedAt,
            note_markdown = @noteMarkdown,
            note_plain = @notePlain,
            is_favorite = @favorite,
            is_unread = @unread,
            archived_at = @archivedAt,
            updated_at = @updatedAt
          WHERE id = @bookmarkId
        `)
        .run({
          bookmarkId,
          address,
          normalizedAddress,
          addressRevision,
          title,
          titleSortKey: titleSortKey(title),
          titleProvenance,
          titleCandidate,
          description,
          descriptionProvenance,
          descriptionCandidate,
          iconHash,
          metadataStatus,
          metadataErrorCode,
          metadataFetchedAt,
          noteMarkdown: preparedNote?.markdown ?? current.note_markdown,
          notePlain: preparedNote?.plainText ?? current.note_plain,
          favorite: patch.favorite === undefined ? current.is_favorite : patch.favorite ? 1 : 0,
          unread: patch.unread === undefined ? current.is_unread : patch.unread ? 1 : 0,
          archivedAt,
          updatedAt: now,
        });

      if (patch.tags !== undefined) this.tags.replaceForBookmark(bookmarkId, patch.tags, now);
      this.search.synchronizeBookmark(bookmarkId);
      return { bookmark: this.bookmarks.get(bookmarkId), metadataRequest };
    });

    try {
      return update.immediate();
    } catch (error) {
      if (
        preparedAddress &&
        !(error instanceof DuplicateBookmarkError) &&
        !(error instanceof BookmarkNotFoundError) &&
        !(error instanceof BookmarkTitleValidationError) &&
        !(error instanceof NoteValidationError)
      ) {
        const raced = this.bookmarks.findIdentityByNormalizedAddress(
          preparedAddress.normalizedAddress,
        );
        if (raced && raced.id !== bookmarkId) throw new DuplicateBookmarkError(raced);
      }
      throw error;
    }
  }

  requestMetadataRefresh(bookmarkId: number): MetadataRequest {
    const now = this.now().toISOString();
    const refresh = this.database.transaction(() => {
      const row = this.bookmarks.getRow(bookmarkId);
      if (!row) throw new BookmarkNotFoundError();
      this.database
        .prepare(`
          UPDATE bookmarks
          SET metadata_status = 'pending', metadata_error_code = NULL,
              metadata_fetched_at = NULL, updated_at = ?
          WHERE id = ?
        `)
        .run(now, bookmarkId);
      return {
        bookmarkId,
        address: row.address,
        addressRevision: row.address_revision,
      };
    });
    return refresh.immediate();
  }
}

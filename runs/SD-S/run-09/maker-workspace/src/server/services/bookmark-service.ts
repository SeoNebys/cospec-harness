import type { CreateBookmarkInput, UpdateBookmarkInput } from "../../shared/contracts/bookmarks.js";
import type { AppConfig } from "../config.js";
import { AppError } from "../api/errors.js";
import type { BookmarkRepository } from "../repositories/bookmark-repository.js";
import type { IconRepository } from "../repositories/icon-repository.js";
import type { MetadataService } from "../metadata/metadata-service.js";
import { verifyReceipt } from "../metadata/receipt.js";
import { parseBookmarkUrl } from "../metadata/url-policy.js";

export class BookmarkService {
  constructor(
    private readonly bookmarks: BookmarkRepository,
    private readonly icons: IconRepository,
    private readonly metadata: MetadataService,
    private readonly config: AppConfig
  ) {}

  create(userId: string, input: CreateBookmarkInput) {
    const parsed = parseBookmarkUrl(input.url);
    const duplicate = this.bookmarks.findDuplicate(userId, parsed.normalizedUrl);
    if (duplicate && input.duplicateAction !== "save_anyway") {
      throw new AppError(409, "DUPLICATE_BOOKMARK", "You already saved this address", {
        existingBookmark: { id: duplicate.id, title: duplicate.title, url: duplicate.url }
      });
    }
    const receipt = input.metadataReceipt ? verifyReceipt(input.metadataReceipt, this.config.authSecret) : null;
    const receiptMatches = receipt?.userId === userId && receipt.normalizedUrl === parsed.normalizedUrl;
    const userTitle = input.title?.trim();
    const bookmark = this.bookmarks.create(userId, {
      ...input,
      normalizedUrl: parsed.normalizedUrl,
      resolvedTitle: userTitle || (receiptMatches ? receipt.title : parsed.fallbackTitle),
      titleSource: userTitle ? "user" : receiptMatches ? receipt.titleSource : "fallback",
      metadataStatus: receiptMatches ? receipt.status : "pending",
      metadataFailureCode: receiptMatches ? receipt.failureCode : null,
      iconAssetId: receiptMatches ? receipt.iconAssetId : null,
      finalMetadataUrl: receiptMatches ? receipt.finalUrl : null
    });
    if (!receiptMatches) void this.metadata.enrichBookmark(this.bookmarks, userId, bookmark.id, bookmark.url);
    return bookmark;
  }

  update(userId: string, id: number, input: UpdateBookmarkInput) {
    let normalizedUrl: string | undefined;
    let metadataFallbackTitle: string | undefined;
    if (input.url) {
      const parsed = parseBookmarkUrl(input.url);
      normalizedUrl = parsed.normalizedUrl;
      metadataFallbackTitle = parsed.fallbackTitle;
      const duplicate = this.bookmarks.findDuplicate(userId, normalizedUrl, id);
      if (duplicate && input.duplicateAction !== "save_anyway") {
        throw new AppError(409, "DUPLICATE_BOOKMARK", "You already saved this address", {
          existingBookmark: { id: duplicate.id, title: duplicate.title, url: duplicate.url }
        });
      }
    }
    const updated = this.bookmarks.update(userId, id, { ...input, ...(normalizedUrl ? { normalizedUrl, metadataFallbackTitle } : {}) });
    if (!updated) throw new AppError(404, "NOT_FOUND", "Bookmark not found");
    if (input.url) void this.metadata.enrichBookmark(this.bookmarks, userId, id, input.url);
    return updated;
  }

  setFavorite(userId: string, id: number, value: boolean) {
    const bookmark = this.bookmarks.setFavorite(userId, id, value);
    if (!bookmark) throw new AppError(404, "NOT_FOUND", "Bookmark not found");
    return bookmark;
  }

  delete(userId: string, id: number): void {
    if (!this.bookmarks.delete(userId, id)) throw new AppError(404, "NOT_FOUND", "Bookmark not found");
    this.icons.cleanupOrphans();
  }

  retry(userId: string, id: number): void {
    const bookmark = this.bookmarks.find(userId, id);
    if (!bookmark) throw new AppError(404, "NOT_FOUND", "Bookmark not found");
    this.metadata.reserveAttempt(userId);
    this.bookmarks.markPending(userId, id);
    void this.metadata.enrichBookmark(this.bookmarks, userId, id, bookmark.url);
  }
}

import type { Bookmark } from "../../../shared/contracts/api.js";
import type {
  BookmarkRepository,
  BookmarkScopeCounts,
} from "../../repositories/bookmark-repository.js";

export type BookmarkStateClock = () => Date;

/** Coordinates independent bookmark status transitions used by thin routes. */
export class BookmarkStateService {
  constructor(
    private readonly bookmarks: BookmarkRepository,
    private readonly now: BookmarkStateClock = () => new Date(),
  ) {}

  setUnread(bookmarkId: number, unread: boolean): Bookmark {
    return this.bookmarks.updateReadingState(bookmarkId, unread, this.now().toISOString());
  }

  getScopeCounts(): BookmarkScopeCounts {
    return this.bookmarks.scopeCounts();
  }

  getReadLaterCount(): number {
    return this.getScopeCounts().readLater;
  }
}

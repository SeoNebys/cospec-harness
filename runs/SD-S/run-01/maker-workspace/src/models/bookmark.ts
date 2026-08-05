// Core data types for the bookmark manager. See specs/001-bookmark-manager/data-model.md.

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  notes: string;
  tags: string[];
  dateSaved: number; // epoch ms, immutable after creation
  dateModified: number; // epoch ms, updated on every edit
}

export interface NewBookmarkInput {
  url: string;
  title?: string;
  notes?: string;
  tags?: string[];
}

export interface BookmarkQuery {
  keyword?: string;
  tag?: string;
}

// Thrown when user input fails validation; `message` is safe to show in the UI.
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

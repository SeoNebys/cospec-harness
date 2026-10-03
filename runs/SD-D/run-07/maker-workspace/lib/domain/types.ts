export type Bookmark = {
  id: string;
  url: string;
  normalizedUrl: string;
  title: string;
  description: string;
  note: string;
  iconUrl: string | null;
  isFavorite: boolean;
  isRead: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags: string[];
};

export type Sort = "newest" | "updated" | "title";
export type View = "all" | "unread" | "favorites" | "archived";

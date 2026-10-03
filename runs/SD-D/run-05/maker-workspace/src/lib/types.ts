export type SortKey = "newest" | "oldest" | "title_asc" | "title_desc" | "updated";
export type Scope = "active" | "archived" | "all";
export interface Bookmark {
  id: string; displayUrl: string; normalizedUrl: string; title: string; description: string;
  iconPath: string | null; noteMarkdown: string; tags: string[]; isRead: boolean;
  archivedAt: string | null; createdAt: string; updatedAt: string;
}
export interface Preferences { defaultSort: SortKey; pageSize: 10 | 25 | 50 | 100; textSize: "small" | "standard" | "large" }
export interface Criteria { q: string; scope: Scope; read: "all" | "read" | "unread"; sort: SortKey }

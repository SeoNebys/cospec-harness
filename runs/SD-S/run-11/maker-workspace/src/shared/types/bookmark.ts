export const LIMITS = { url: 2048, title: 300, description: 1000, tag: 50, tags: 20, search: 200 } as const;
export type View = 'active' | 'archived';
export type Sort = 'newest' | 'oldest' | 'title';
export interface Tag { id: string; name: string; bookmarkCount: number }
export interface Bookmark {
  id: string; url: string; title: string; description: string | null; tags: Tag[];
  favorite: boolean; archivedAt: string | null; createdAt: string; updatedAt: string;
}
export interface LibraryQuery { view: View; q: string; tags: string[]; favorite: boolean; sort: Sort }
export interface MetadataPreview {
  normalizedUrl: string; status: 'available' | 'partial' | 'unavailable';
  title: string | null; description: string | null; message: string | null;
}

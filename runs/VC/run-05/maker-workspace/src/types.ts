export interface Bookmark {
  id: number;
  url: string;
  title: string;
  notes: string;
  created_at: string;
  tags: string[];
}

export interface Tag {
  name: string;
  count: number;
}

export interface BookmarkDraft {
  url: string;
  title: string;
  notes: string;
  tags: string[];
}

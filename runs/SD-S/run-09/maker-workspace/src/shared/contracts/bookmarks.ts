export type TitleSource = "page" | "fallback" | "user";
export type MetadataStatus = "pending" | "ready" | "partial" | "blocked" | "failed";

export type BookmarkTag = { id: number; name: string };
export type BookmarkFolder = { id: number; name: string } | null;

export type Bookmark = {
  id: number;
  url: string;
  title: string;
  titleSource: TitleSource;
  notes: string | null;
  folder: BookmarkFolder;
  tags: BookmarkTag[];
  isFavorite: boolean;
  metadataStatus: MetadataStatus;
  metadataFailureCode: string | null;
  iconUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type BookmarkPage = { items: Bookmark[]; nextCursor: string | null; total: number };

export type MetadataPreview = {
  title: string;
  titleSource: "page" | "fallback";
  iconDataUrl: string | null;
  status: MetadataStatus;
  failureCode: string | null;
  receipt: string;
};

export type CreateBookmarkInput = {
  url: string;
  title?: string;
  notes?: string | null;
  folderId?: number | null;
  tagIds?: number[];
  isFavorite?: boolean;
  metadataReceipt?: string;
  duplicateAction?: "save_anyway";
};

export type UpdateBookmarkInput = Partial<Omit<CreateBookmarkInput, "metadataReceipt">> & {
  title?: string;
};

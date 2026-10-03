export type BookmarkStatus = "active" | "archived";
export type MetadataStatus = "complete" | "partial" | "failed";
export type TitleSource = "metadata" | "fallback" | "user";

export interface TagDto { id: string; name: string }

export interface BookmarkDto {
  id: string;
  url: string;
  title: string;
  titleSource: TitleSource;
  description: string | null;
  notes: string | null;
  iconUrl: string | null;
  metadataStatus: MetadataStatus;
  metadataMessage: string | null;
  isFavorite: boolean;
  status: BookmarkStatus;
  tags: TagDto[];
  version: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MetadataResult {
  title: string | null;
  description: string | null;
  icon?: { id: string; mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp"; content: Buffer };
  status: MetadataStatus;
  messageCode: string | null;
}

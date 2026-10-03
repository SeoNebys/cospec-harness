import "server-only";
import { bookmarkWriteSchema } from "./validation";
import { normalizeBookmarkUrl } from "./url-normalizer";
import { cacheIcon } from "./icon-service";
import { retrieveMetadata } from "./metadata-service";
import { noteToPlainText, validateNote } from "./note-service";
import { createBookmark, findDuplicate, updateBookmarkRecord } from "@/lib/db/repositories/bookmark-repository";

export class DuplicateBookmarkError extends Error {
  constructor(public readonly bookmarkId: string, public readonly view: "active" | "archive") {
    super("This address is already in your collection.");
  }
}

export async function previewBookmark(userId: string, input: string) {
  const normalized = normalizeBookmarkUrl(input);
  const duplicate = findDuplicate(userId, normalized.normalizedUrl);
  if (duplicate) throw new DuplicateBookmarkError(duplicate.id, duplicate.archived ? "archive" : "active");
  const draft = await retrieveMetadata(normalized.url);
  const iconPreviewKey = await cacheIcon(draft.iconUrl);
  return { ...draft, iconPreviewKey };
}

export function saveBookmark(userId: string, raw: unknown) {
  const input = bookmarkWriteSchema.parse(raw);
  const normalized = normalizeBookmarkUrl(input.url);
  const duplicate = findDuplicate(userId, normalized.normalizedUrl);
  if (duplicate) throw new DuplicateBookmarkError(duplicate.id, duplicate.archived ? "archive" : "active");
  return createBookmark({
    userId,
    url: normalized.url,
    normalizedUrl: normalized.normalizedUrl,
    title: input.title,
    pageDescription: input.pageDescription ?? null,
    iconKey: input.iconPreviewKey ?? null,
    noteMarkdown: input.noteMarkdown ? validateNote(input.noteMarkdown) : null,
    notePlainText: input.noteMarkdown ? noteToPlainText(input.noteMarkdown) : "",
    readingState: input.readingState,
    metadataStatus: input.metadataStatus,
    tags: input.tags,
  });
}

export async function editBookmark(userId: string, id: string, raw: Record<string, unknown>) {
  const values: Parameters<typeof updateBookmarkRecord>[2] = {};
  if (typeof raw.url === "string") {
    const normalized = normalizeBookmarkUrl(raw.url);
    const duplicate = findDuplicate(userId, normalized.normalizedUrl, id);
    if (duplicate) throw new DuplicateBookmarkError(duplicate.id, duplicate.archived ? "archive" : "active");
    values.url = normalized.url;
    values.normalizedUrl = normalized.normalizedUrl;
    if (raw.refreshMetadata === true) {
      const draft = await retrieveMetadata(normalized.url);
      values.metadataStatus = draft.status;
      values.iconKey = await cacheIcon(draft.iconUrl);
      if (raw.acceptProposedTitle === true) values.title = draft.title;
      if (raw.acceptProposedDescription === true) values.pageDescription = draft.pageDescription;
    }
  }
  if (typeof raw.title === "string") values.title = bookmarkWriteSchema.shape.title.parse(raw.title);
  if (typeof raw.pageDescription === "string" || raw.pageDescription === null) values.pageDescription = bookmarkWriteSchema.shape.pageDescription.parse(raw.pageDescription);
  if (typeof raw.noteMarkdown === "string" || raw.noteMarkdown === null) {
    values.noteMarkdown = raw.noteMarkdown ? validateNote(bookmarkWriteSchema.shape.noteMarkdown.parse(raw.noteMarkdown)!) : null;
    values.notePlainText = raw.noteMarkdown ? noteToPlainText(raw.noteMarkdown) : "";
  }
  if (Array.isArray(raw.tags)) values.tags = bookmarkWriteSchema.shape.tags.parse(raw.tags);
  if (["none", "unread", "read"].includes(String(raw.readingState))) values.readingState = raw.readingState as "none" | "unread" | "read";
  if (typeof raw.archived === "boolean") values.archived = raw.archived;
  return updateBookmarkRecord(userId, id, values);
}

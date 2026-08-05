import { db } from './db';
import { deriveTitle, normalizeUrl } from '../lib/url';
import type { Bookmark, BookmarkQuery, NewBookmarkInput } from '../models/bookmark';

// The data-layer contract the UI depends on. See contracts/data-layer.md.
// All operations are async (IndexedDB is async).

function newId(): string {
  return crypto.randomUUID();
}

// Trim, drop empties, de-duplicate (case-insensitive) while preserving order.
function cleanTags(tags: string[] | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags ?? []) {
    const tag = raw.trim();
    if (tag === '') continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
  }
  return result;
}

/** Create and persist a new bookmark. Throws ValidationError on a bad URL. */
export async function add(input: NewBookmarkInput): Promise<Bookmark> {
  const url = normalizeUrl(input.url); // VR-001
  const title = (input.title ?? '').trim() || deriveTitle(url); // VR-002
  const now = Date.now();
  const bookmark: Bookmark = {
    id: newId(),
    url,
    title,
    notes: (input.notes ?? '').trim(),
    tags: cleanTags(input.tags), // VR-003
    dateSaved: now,
    dateModified: now,
  };
  await db.bookmarks.add(bookmark);
  return bookmark;
}

/** Existing bookmarks whose normalized URL matches. Used for the duplicate warning (VR-004). */
export async function findByUrl(url: string): Promise<Bookmark[]> {
  let normalized: string;
  try {
    normalized = normalizeUrl(url);
  } catch {
    return [];
  }
  // `url` is not an indexed key (schema indexes id/dateSaved/tags), so filter in
  // memory — fine at the target scale, consistent with keyword search.
  return db.bookmarks.filter((b) => b.url === normalized).toArray();
}

/** Fetch a single bookmark by id. */
export async function get(id: string): Promise<Bookmark | undefined> {
  return db.bookmarks.get(id);
}

/**
 * List bookmarks, most-recent-first (FR-014). Optional `tag` restricts to that
 * tag (FR-010); optional `keyword` matches title/url/tags (FR-011). When both
 * are given they combine with AND.
 */
export async function list(query: BookmarkQuery = {}): Promise<Bookmark[]> {
  let bookmarks = await db.bookmarks.orderBy('dateSaved').reverse().toArray();

  if (query.tag) {
    const tag = query.tag.toLowerCase();
    bookmarks = bookmarks.filter((b) => b.tags.some((t) => t.toLowerCase() === tag));
  }

  const keyword = query.keyword?.trim().toLowerCase();
  if (keyword) {
    bookmarks = bookmarks.filter(
      (b) =>
        b.title.toLowerCase().includes(keyword) ||
        b.url.toLowerCase().includes(keyword) ||
        b.tags.some((t) => t.toLowerCase().includes(keyword)),
    );
  }

  return bookmarks;
}

/** Distinct tag labels across all bookmarks, sorted, for the filter UI (FR-010). */
export async function listTags(): Promise<string[]> {
  const bookmarks = await db.bookmarks.toArray();
  const seen = new Map<string, string>(); // lowercase key -> first-seen label
  for (const b of bookmarks) {
    for (const tag of b.tags) {
      const key = tag.toLowerCase();
      if (!seen.has(key)) seen.set(key, tag);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** Apply changes to a bookmark. Re-validates the URL if changed; bumps dateModified (FR-007). */
export async function update(
  id: string,
  changes: Partial<NewBookmarkInput>,
): Promise<Bookmark> {
  const existing = await db.bookmarks.get(id);
  if (!existing) {
    throw new Error(`Bookmark ${id} not found.`);
  }

  const url = changes.url !== undefined ? normalizeUrl(changes.url) : existing.url;
  const title =
    changes.title !== undefined
      ? changes.title.trim() || deriveTitle(url)
      : existing.title;
  const notes = changes.notes !== undefined ? changes.notes.trim() : existing.notes;
  const tags = changes.tags !== undefined ? cleanTags(changes.tags) : existing.tags;

  const updated: Bookmark = {
    ...existing,
    url,
    title,
    notes,
    tags,
    dateModified: Date.now(), // VR-005; dateSaved is preserved
  };
  await db.bookmarks.put(updated);
  return updated;
}

/** Delete a bookmark. The UI confirms before calling (FR-008). */
export async function remove(id: string): Promise<void> {
  await db.bookmarks.delete(id);
}

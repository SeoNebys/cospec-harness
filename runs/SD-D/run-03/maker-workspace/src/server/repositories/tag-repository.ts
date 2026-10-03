import type { Tag, TagSummary } from "../../shared/contracts/api.js";
import { normalizeExactTag } from "../../shared/search/tokenizer.js";
import type { AppDatabase } from "../db/database.js";

export interface NormalizedTagName {
  displayName: string;
  nameKey: string;
}

interface TagSummaryRow {
  id: number;
  name: string;
  activeBookmarkCount: number;
}

export class TagNameValidationError extends Error {
  readonly code = "INVALID_TAG_NAME";
  readonly field = "tag";

  constructor() {
    super("A tag name must contain at least one non-whitespace character.");
    this.name = "TagNameValidationError";
  }
}

/**
 * Preserves the user's spelling while deriving the Unicode-safe identity used
 * by both relational tag reads and exact `#tag` search expressions.
 */
export function normalizeTagName(value: string): NormalizedTagName {
  const displayName = value.replace(/\s+/gu, " ").trim();
  if (displayName === "") throw new TagNameValidationError();
  return { displayName, nameKey: normalizeExactTag(displayName) };
}

const SUMMARY_SELECT = `
  SELECT
    tags.id,
    tags.display_name AS name,
    count(
      CASE WHEN bookmarks.id IS NOT NULL AND bookmarks.archived_at IS NULL THEN 1 END
    ) AS activeBookmarkCount
  FROM tags
  LEFT JOIN bookmark_tags ON bookmark_tags.tag_id = tags.id
  LEFT JOIN bookmarks ON bookmarks.id = bookmark_tags.bookmark_id
`;

function toSummary(row: TagSummaryRow): TagSummary {
  return {
    id: row.id,
    name: row.name,
    activeBookmarkCount: row.activeBookmarkCount,
  };
}

/** Read-only tag queries. Writes are added with bookmark editing/bulk actions. */
export class TagRepository {
  constructor(private readonly database: AppDatabase) {}

  listSummaries(): TagSummary[] {
    const rows = this.database
      .prepare(`
        ${SUMMARY_SELECT}
        GROUP BY tags.id, tags.display_name, tags.name_key
        ORDER BY tags.name_key ASC, tags.id ASC
      `)
      .all() as TagSummaryRow[];
    return rows.map(toSummary);
  }

  findExact(name: string): TagSummary | null {
    const nameKey = normalizeTagName(name).nameKey;
    const row = this.database
      .prepare(`
        ${SUMMARY_SELECT}
        WHERE tags.name_key = ?
        GROUP BY tags.id, tags.display_name, tags.name_key
      `)
      .get(nameKey) as TagSummaryRow | undefined;
    return row ? toSummary(row) : null;
  }

  findPartial(name: string, limit = 20): TagSummary[] {
    const nameKey = normalizeTagName(name).nameKey;
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
    const rows = this.database
      .prepare(`
        ${SUMMARY_SELECT}
        WHERE instr(tags.name_key, ?) > 0
        GROUP BY tags.id, tags.display_name, tags.name_key
        ORDER BY tags.name_key ASC, tags.id ASC
        LIMIT ?
      `)
      .all(nameKey, safeLimit) as TagSummaryRow[];
    return rows.map(toSummary);
  }

  listForBookmark(bookmarkId: number): Tag[] {
    return this.database
      .prepare(`
        SELECT tags.id, tags.display_name AS name
        FROM tags
        JOIN bookmark_tags ON bookmark_tags.tag_id = tags.id
        WHERE bookmark_tags.bookmark_id = ?
        ORDER BY tags.name_key ASC, tags.id ASC
      `)
      .all(bookmarkId) as Tag[];
  }

  /**
   * Replaces one bookmark's complete tag set. Existing normalized identities
   * retain their first stored display spelling; duplicate input spellings are
   * collapsed before any write. Orphans are removed in the same transaction.
   */
  replaceForBookmark(bookmarkId: number, names: readonly string[], now: string): Tag[] {
    const normalized = new Map<string, NormalizedTagName>();
    for (const name of names) {
      const tag = normalizeTagName(name);
      if (!normalized.has(tag.nameKey)) normalized.set(tag.nameKey, tag);
    }

    const replace = this.database.transaction(() => {
      this.database.prepare("DELETE FROM bookmark_tags WHERE bookmark_id = ?").run(bookmarkId);

      const create = this.database.prepare(`
        INSERT INTO tags(display_name, name_key, created_at)
        VALUES (?, ?, ?)
        ON CONFLICT(name_key) DO NOTHING
      `);
      const attach = this.database.prepare(`
        INSERT INTO bookmark_tags(bookmark_id, tag_id)
        SELECT ?, id FROM tags WHERE name_key = ?
      `);
      for (const tag of normalized.values()) {
        create.run(tag.displayName, tag.nameKey, now);
        attach.run(bookmarkId, tag.nameKey);
      }

      this.database.exec(`
        DELETE FROM tags
        WHERE NOT EXISTS (
          SELECT 1 FROM bookmark_tags WHERE bookmark_tags.tag_id = tags.id
        )
      `);
      return this.listForBookmark(bookmarkId);
    });
    return replace();
  }
}

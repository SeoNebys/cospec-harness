import type {
  Bookmark,
  BookmarkPage,
  MetadataStatus,
  Provenance,
  Scope,
  SortOrder,
} from "../../shared/contracts/api.js";
import { parseSearchQueryOrThrow } from "../../shared/search/parser.js";
import type { AppDatabase } from "../db/database.js";
import {
  compileSearchAst,
  normalizeSearchText,
  normalizeTagFilter,
} from "../services/search/search-compiler.js";

export interface SearchRequest {
  scope: Scope;
  query: string;
  tags: readonly string[];
  favorite?: boolean | null;
  unread?: boolean | null;
  sort: SortOrder;
  cursor?: string;
  limit?: number;
}

interface BookmarkRow {
  id: number;
  address: string;
  normalized_address: string;
  address_revision: number;
  title: string;
  title_sort_key: string;
  title_provenance: Provenance;
  retrieved_title_candidate: string | null;
  description: string;
  description_provenance: Provenance;
  retrieved_description_candidate: string | null;
  icon_hash: string | null;
  metadata_status: MetadataStatus;
  metadata_error_code: string | null;
  metadata_fetched_at: string | null;
  note_markdown: string;
  note_plain: string;
  is_favorite: 0 | 1;
  is_unread: 0 | 1;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CursorPayload {
  v: 1;
  sort: SortOrder;
  key: string;
  id: number;
}

interface SearchSql {
  withClause: string;
  fromClause: string;
  whereClause: string;
  parameters: unknown[];
}

const SORT_SQL: Record<SortOrder, string> = {
  created_desc: "b.created_at DESC, b.id DESC",
  created_asc: "b.created_at ASC, b.id ASC",
  updated_desc: "b.updated_at DESC, b.id DESC",
  title_asc: "b.title_sort_key ASC, b.id ASC",
};

export class InvalidSearchCursorError extends Error {
  constructor() {
    super("The search cursor is invalid or does not match the current sort.");
    this.name = "InvalidSearchCursorError";
  }
}

function cursorKey(row: BookmarkRow, sort: SortOrder): string {
  if (sort === "created_desc" || sort === "created_asc") return row.created_at;
  if (sort === "updated_desc") return row.updated_at;
  return row.title_sort_key;
}

function encodeCursor(row: BookmarkRow, sort: SortOrder): string {
  const payload: CursorPayload = { v: 1, sort, key: cursorKey(row, sort), id: row.id };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(value: string, sort: SortOrder): CursorPayload {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<CursorPayload>;
    if (
      parsed.v !== 1 ||
      parsed.sort !== sort ||
      typeof parsed.key !== "string" ||
      parsed.key.length === 0 ||
      !Number.isSafeInteger(parsed.id) ||
      (parsed.id ?? 0) < 1
    ) {
      throw new InvalidSearchCursorError();
    }
    return parsed as CursorPayload;
  } catch (error) {
    if (error instanceof InvalidSearchCursorError) throw error;
    throw new InvalidSearchCursorError();
  }
}

function cursorPredicate(
  sort: SortOrder,
  cursor: CursorPayload,
): { sql: string; values: unknown[] } {
  if (sort === "created_desc") {
    return {
      sql: "(b.created_at < ? OR (b.created_at = ? AND b.id < ?))",
      values: [cursor.key, cursor.key, cursor.id],
    };
  }
  if (sort === "created_asc") {
    return {
      sql: "(b.created_at > ? OR (b.created_at = ? AND b.id > ?))",
      values: [cursor.key, cursor.key, cursor.id],
    };
  }
  if (sort === "updated_desc") {
    return {
      sql: "(b.updated_at < ? OR (b.updated_at = ? AND b.id < ?))",
      values: [cursor.key, cursor.key, cursor.id],
    };
  }
  return {
    sql: "(b.title_sort_key > ? OR (b.title_sort_key = ? AND b.id > ?))",
    values: [cursor.key, cursor.key, cursor.id],
  };
}

function scopePredicate(scope: Scope): string {
  if (scope === "read_later") return "b.archived_at IS NULL AND b.is_unread = 1";
  if (scope === "archived") return "b.archived_at IS NOT NULL";
  return "b.archived_at IS NULL";
}

function toBookmark(row: BookmarkRow, tags: Bookmark["tags"]): Bookmark {
  return {
    id: row.id,
    address: row.address,
    title: row.title,
    titleProvenance: row.title_provenance,
    retrievedTitleCandidate: row.retrieved_title_candidate,
    description: row.description,
    descriptionProvenance: row.description_provenance,
    retrievedDescriptionCandidate: row.retrieved_description_candidate,
    iconUrl: row.icon_hash ? `/api/bookmarks/${row.id}/icon` : null,
    metadataStatus: row.metadata_status,
    metadataErrorCode: row.metadata_error_code,
    noteMarkdown: row.note_markdown,
    tags,
    favorite: row.is_favorite === 1,
    unread: row.is_unread === 1,
    archived: row.archived_at !== null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SearchRepository {
  constructor(private readonly database: AppDatabase) {
    this.database.function("search_normalize", { deterministic: true }, (value: unknown) =>
      normalizeSearchText(typeof value === "string" ? value : ""),
    );
    this.verifySearchSupport();
  }

  /** Fail clearly during startup if the migration/index is absent or unusable. */
  verifySearchSupport(): void {
    try {
      this.database
        .prepare("SELECT rowid FROM bookmark_search WHERE bookmark_search MATCH ? LIMIT 0")
        .all('"trigram capability probe"');
    } catch (error) {
      throw new Error(
        `SQLite FTS5 trigram search is unavailable: ${error instanceof Error ? error.message : "unknown error"}`,
        { cause: error },
      );
    }
  }

  search(criteria: SearchRequest): BookmarkPage {
    const limit = Math.max(1, Math.min(criteria.limit ?? 50, 100));
    const base = this.buildSql(criteria);
    const total = (
      this.database
        .prepare(
          `${base.withClause} SELECT count(*) AS count ${base.fromClause} ${base.whereClause}`,
        )
        .get(...base.parameters) as { count: number }
    ).count;

    const pageWhere: string[] = [];
    const pageParameters = [...base.parameters];
    if (criteria.cursor) {
      const predicate = cursorPredicate(
        criteria.sort,
        decodeCursor(criteria.cursor, criteria.sort),
      );
      pageWhere.push(predicate.sql);
      pageParameters.push(...predicate.values);
    }
    const cursorSql = pageWhere.length > 0 ? ` AND ${pageWhere.join(" AND ")}` : "";
    const fetched = this.database
      .prepare(
        `${base.withClause} SELECT b.* ${base.fromClause} ${base.whereClause}${cursorSql} ` +
          `ORDER BY ${SORT_SQL[criteria.sort]} LIMIT ?`,
      )
      .all(...pageParameters, limit + 1) as BookmarkRow[];

    const hasMore = fetched.length > limit;
    const rows = hasMore ? fetched.slice(0, limit) : fetched;
    const tagsByBookmark = this.tagsFor(rows.map(({ id }) => id));
    const items = rows.map((row) => toBookmark(row, tagsByBookmark.get(row.id) ?? []));

    return {
      items,
      total,
      nextCursor:
        hasMore && rows.length > 0
          ? encodeCursor(rows[rows.length - 1] as BookmarkRow, criteria.sort)
          : null,
    };
  }

  /** Full current result membership, used later to create stable bulk snapshots. */
  matchingIds(criteria: Omit<SearchRequest, "cursor" | "limit">): number[] {
    const base = this.buildSql(criteria);
    return (
      this.database
        .prepare(
          `${base.withClause} SELECT b.id ${base.fromClause} ${base.whereClause} ` +
            `ORDER BY ${SORT_SQL[criteria.sort]}`,
        )
        .all(...base.parameters) as Array<{ id: number }>
    ).map(({ id }) => id);
  }

  /** Replace one contentful FTS row with application-normalized field values. */
  synchronizeBookmark(bookmarkId: number): void {
    const row = this.database
      .prepare("SELECT id, title, address, description, note_plain FROM bookmarks WHERE id = ?")
      .get(bookmarkId) as
      | { id: number; title: string; address: string; description: string; note_plain: string }
      | undefined;
    if (!row) {
      this.database.prepare("DELETE FROM bookmark_search WHERE rowid = ?").run(bookmarkId);
      return;
    }

    const replace = this.database.transaction(() => {
      this.database.prepare("DELETE FROM bookmark_search WHERE rowid = ?").run(bookmarkId);
      this.database
        .prepare(
          "INSERT INTO bookmark_search(rowid, title, address, description, note_plain) VALUES (?, ?, ?, ?, ?)",
        )
        .run(
          row.id,
          normalizeSearchText(row.title),
          normalizeSearchText(row.address),
          normalizeSearchText(row.description),
          normalizeSearchText(row.note_plain),
        );
    });
    replace();
  }

  rebuildSearchIndex(): void {
    const ids = this.database.prepare("SELECT id FROM bookmarks ORDER BY id").all() as Array<{
      id: number;
    }>;
    const rebuild = this.database.transaction(() => {
      this.database.prepare("DELETE FROM bookmark_search").run();
      for (const { id } of ids) this.synchronizeBookmark(id);
    });
    rebuild();
  }

  private buildSql(criteria: Omit<SearchRequest, "cursor" | "limit">): SearchSql {
    const compiled = compileSearchAst(parseSearchQueryOrThrow(criteria.query));
    const withClause = `WITH search_matches(id) AS (${compiled.sql})`;
    const fromClause = "FROM bookmarks b JOIN search_matches m ON m.id = b.id";
    const predicates = [scopePredicate(criteria.scope)];
    const parameters: unknown[] = [...compiled.parameters];

    if (criteria.favorite !== null && criteria.favorite !== undefined) {
      predicates.push("b.is_favorite = ?");
      parameters.push(criteria.favorite ? 1 : 0);
    }
    if (criteria.unread !== null && criteria.unread !== undefined) {
      predicates.push("b.is_unread = ?");
      parameters.push(criteria.unread ? 1 : 0);
    }

    const tagKeys = [...new Set(criteria.tags.map(normalizeTagFilter))];
    if (tagKeys.length > 0) {
      predicates.push(`b.id IN (
        SELECT bt.bookmark_id
        FROM bookmark_tags bt
        JOIN tags t ON t.id = bt.tag_id
        WHERE t.name_key IN (${tagKeys.map(() => "?").join(", ")})
        GROUP BY bt.bookmark_id
        HAVING count(DISTINCT t.name_key) = ?
      )`);
      parameters.push(...tagKeys, tagKeys.length);
    }

    return {
      withClause,
      fromClause,
      whereClause: `WHERE ${predicates.join(" AND ")}`,
      parameters,
    };
  }

  private tagsFor(bookmarkIds: number[]): Map<number, Bookmark["tags"]> {
    const grouped = new Map<number, Bookmark["tags"]>();
    if (bookmarkIds.length === 0) return grouped;
    const rows = this.database
      .prepare(`
        SELECT bt.bookmark_id, t.id, t.display_name
        FROM bookmark_tags bt
        JOIN tags t ON t.id = bt.tag_id
        WHERE bt.bookmark_id IN (${bookmarkIds.map(() => "?").join(", ")})
        ORDER BY t.name_key, t.id
      `)
      .all(...bookmarkIds) as Array<{ bookmark_id: number; id: number; display_name: string }>;
    for (const row of rows) {
      const tags = grouped.get(row.bookmark_id) ?? [];
      tags.push({ id: row.id, name: row.display_name });
      grouped.set(row.bookmark_id, tags);
    }
    return grouped;
  }
}

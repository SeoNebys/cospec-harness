import { createHash, randomBytes } from "node:crypto";
import type { SearchCriteria, Selection } from "../../shared/contracts/api.js";
import { normalizeExactTag } from "../../shared/search/tokenizer.js";
import type { AppDatabase } from "../db/database.js";
import { SearchRepository } from "./search-repository.js";

const DEFAULT_SELECTION_TTL_MS = 15 * 60 * 1_000;
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;

interface SelectionRow {
  id: string;
  criteria_hash: string;
  selected_count: number;
  created_at: string;
  expires_at: string;
}

export interface SelectionRepositoryOptions {
  ttlMs?: number;
  token?: () => string;
}

export interface ConsumedSelection {
  id: string;
  criteriaHash: string;
  selectedCount: number;
  bookmarkIds: readonly number[];
}

export class SelectionNotFoundError extends Error {
  constructor() {
    super("Selection not found or already consumed.");
    this.name = "SelectionNotFoundError";
  }
}

export class SelectionExpiredError extends Error {
  constructor() {
    super("The selection expired. Select the bookmarks again.");
    this.name = "SelectionExpiredError";
  }
}

export class SelectionCriteriaHashError extends Error {
  readonly code = "SELECTION_CRITERIA_MISMATCH";
  readonly field = "criteriaHash";

  constructor() {
    super("The selection does not match the supplied view criteria.");
    this.name = "SelectionCriteriaHashError";
  }
}

export class EmptySelectionError extends Error {
  readonly code = "EMPTY_SELECTION";
  readonly field = "ids";

  constructor() {
    super("Select at least one existing bookmark.");
    this.name = "EmptySelectionError";
  }
}

function canonicalCriteria(criteria: SearchCriteria) {
  return {
    scope: criteria.scope,
    query: criteria.query,
    tags: [...new Set(criteria.tags.map(normalizeExactTag))].sort(),
    favorite: criteria.favorite ?? null,
    unread: criteria.unread ?? null,
    sort: criteria.sort,
  };
}

export function computeCriteriaHash(criteria: SearchCriteria): string {
  const digest = createHash("sha256")
    .update(JSON.stringify(canonicalCriteria(criteria)), "utf8")
    .digest("hex");
  return `sha256:${digest}`;
}

function toSelection(row: SelectionRow): Selection {
  return {
    id: row.id,
    criteriaHash: row.criteria_hash,
    selectedCount: row.selected_count,
    expiresAt: row.expires_at,
  };
}

function isExpired(row: SelectionRow, now: string): boolean {
  return row.expires_at <= now;
}

export class SelectionRepository {
  private readonly search: SearchRepository;
  private readonly ttlMs: number;
  private readonly token: () => string;

  constructor(
    private readonly database: AppDatabase,
    private readonly now: () => Date = () => new Date(),
    options: SelectionRepositoryOptions = {},
  ) {
    this.search = new SearchRepository(database);
    this.ttlMs = options.ttlMs ?? DEFAULT_SELECTION_TTL_MS;
    this.token = options.token ?? (() => randomBytes(24).toString("base64url"));
    if (!Number.isFinite(this.ttlMs) || this.ttlMs <= 0) {
      throw new RangeError("Selection expiry must be a positive duration.");
    }
    this.cleanupExpired();
  }

  createIds(ids: readonly number[], criteriaHash: string): Selection {
    this.validateHash(criteriaHash);
    const distinctIds = [...new Set(ids.filter((id) => Number.isSafeInteger(id) && id > 0))];
    return this.materialize(criteriaHash, distinctIds);
  }

  createAllResults(criteria: SearchCriteria, criteriaHash: string): Selection {
    if (criteriaHash !== computeCriteriaHash(criteria)) throw new SelectionCriteriaHashError();
    return this.materialize(criteriaHash, this.search.matchingIds(criteria));
  }

  get(id: string): Selection | null {
    const row = this.row(id);
    if (!row) return null;
    if (isExpired(row, this.now().toISOString())) {
      this.database.prepare("DELETE FROM selection_sets WHERE id = ?").run(id);
      throw new SelectionExpiredError();
    }
    return toSelection(row);
  }

  clear(id: string): void {
    this.database.prepare("DELETE FROM selection_sets WHERE id = ?").run(id);
    this.cleanupExpired();
  }

  cleanupExpired(exceptId?: string): number {
    const now = this.now().toISOString();
    const result = exceptId
      ? this.database
          .prepare("DELETE FROM selection_sets WHERE expires_at <= ? AND id <> ?")
          .run(now, exceptId)
      : this.database.prepare("DELETE FROM selection_sets WHERE expires_at <= ?").run(now);
    return result.changes;
  }

  /** Runs the action and one-time selection deletion in one database transaction. */
  consume<T>(id: string, action: (selection: ConsumedSelection) => T): T {
    this.cleanupExpired(id);
    const now = this.now().toISOString();
    const consume = this.database.transaction(
      (): { status: "expired" } | { status: "complete"; value: T } => {
        const row = this.row(id);
        if (!row) throw new SelectionNotFoundError();
        if (isExpired(row, now)) {
          this.database.prepare("DELETE FROM selection_sets WHERE id = ?").run(id);
          return { status: "expired" };
        }
        const bookmarkIds = (
          this.database
            .prepare(
              "SELECT bookmark_id FROM selection_items WHERE selection_id = ? ORDER BY bookmark_id",
            )
            .all(id) as Array<{ bookmark_id: number }>
        ).map(({ bookmark_id }) => bookmark_id);
        const value = action({
          id: row.id,
          criteriaHash: row.criteria_hash,
          selectedCount: row.selected_count,
          bookmarkIds,
        });
        this.database.prepare("DELETE FROM selection_sets WHERE id = ?").run(id);
        return { status: "complete", value };
      },
    );
    const result = consume.immediate();
    if (result.status === "expired") throw new SelectionExpiredError();
    return result.value;
  }

  private materialize(criteriaHash: string, ids: readonly number[]): Selection {
    this.cleanupExpired();
    const createdAt = this.now();
    const expiresAt = new Date(createdAt.getTime() + this.ttlMs);
    const id = this.token();
    if (id.length < 32) throw new Error("Selection token source returned an unsafe token.");

    const create = this.database.transaction(() => {
      this.database
        .prepare(`
          INSERT INTO selection_sets(id, criteria_hash, selected_count, created_at, expires_at)
          VALUES (?, ?, 1, ?, ?)
        `)
        .run(id, criteriaHash, createdAt.toISOString(), expiresAt.toISOString());
      const insert = this.database.prepare(`
        INSERT OR IGNORE INTO selection_items(selection_id, bookmark_id)
        SELECT ?, id FROM bookmarks WHERE id = ?
      `);
      for (const bookmarkId of ids) insert.run(id, bookmarkId);
      const selectedCount = (
        this.database
          .prepare("SELECT count(*) AS count FROM selection_items WHERE selection_id = ?")
          .get(id) as { count: number }
      ).count;
      if (selectedCount === 0) throw new EmptySelectionError();
      this.database
        .prepare("UPDATE selection_sets SET selected_count = ? WHERE id = ?")
        .run(selectedCount, id);
      return toSelection(this.row(id) as SelectionRow);
    });
    return create.immediate();
  }

  private validateHash(criteriaHash: string): void {
    if (!HASH_PATTERN.test(criteriaHash)) throw new SelectionCriteriaHashError();
  }

  private row(id: string): SelectionRow | undefined {
    return this.database.prepare("SELECT * FROM selection_sets WHERE id = ?").get(id) as
      | SelectionRow
      | undefined;
  }
}

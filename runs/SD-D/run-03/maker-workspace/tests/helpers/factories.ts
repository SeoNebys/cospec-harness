import { DEFAULT_TEST_TIME } from "./clock.js";

export type MetadataStatus = "pending" | "complete" | "partial" | "failed" | "skipped_unsafe";
export type Provenance = "fallback" | "retrieved" | "user";
export type Scope = "active" | "read_later" | "archived";
export type SortOrder = "created_desc" | "created_asc" | "updated_desc" | "title_asc";

export interface TagFixture {
  id: number;
  name: string;
}

export interface BookmarkFixture {
  id: number;
  address: string;
  title: string;
  titleProvenance: Provenance;
  retrievedTitleCandidate: string | null;
  description: string;
  descriptionProvenance: Provenance;
  retrievedDescriptionCandidate: string | null;
  iconUrl: string | null;
  metadataStatus: MetadataStatus;
  metadataErrorCode: string | null;
  noteMarkdown: string;
  tags: TagFixture[];
  favorite: boolean;
  unread: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BookmarkRowFixture {
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

export interface SearchCriteriaFixture {
  scope: Scope;
  query: string;
  tags: string[];
  favorite: boolean | null;
  unread: boolean | null;
  sort: SortOrder;
}

export interface SavedViewFixture extends SearchCriteriaFixture {
  id: number;
  name: string;
  grammarVersion: 1;
  createdAt: string;
  updatedAt: string;
}

export interface SelectionFixture {
  id: string;
  selectedCount: number;
  criteriaHash: string;
  expiresAt: string;
}

function fixtureAddress(id: number): string {
  return `https://example.test/articles/${id}`;
}

export function makeTag(overrides: Partial<TagFixture> = {}): TagFixture {
  const id = overrides.id ?? 1;
  return { id, name: overrides.name ?? `Tag ${id}` };
}

export function makeBookmark(overrides: Partial<BookmarkFixture> = {}): BookmarkFixture {
  const id = overrides.id ?? 1;
  return {
    id,
    address: fixtureAddress(id),
    title: `Example bookmark ${id}`,
    titleProvenance: "retrieved",
    retrievedTitleCandidate: null,
    description: `A deterministic description for bookmark ${id}.`,
    descriptionProvenance: "retrieved",
    retrievedDescriptionCandidate: null,
    iconUrl: `/api/bookmarks/${id}/icon`,
    metadataStatus: "complete",
    metadataErrorCode: null,
    noteMarkdown: "",
    favorite: false,
    unread: false,
    archived: false,
    createdAt: DEFAULT_TEST_TIME,
    updatedAt: DEFAULT_TEST_TIME,
    ...overrides,
    tags: overrides.tags ? [...overrides.tags] : [],
  };
}

export function makeBookmarkRow(overrides: Partial<BookmarkRowFixture> = {}): BookmarkRowFixture {
  const id = overrides.id ?? 1;
  const address = overrides.address ?? fixtureAddress(id);
  const title = overrides.title ?? `Example bookmark ${id}`;
  return {
    id,
    address,
    normalized_address: overrides.normalized_address ?? address,
    address_revision: 1,
    title,
    title_sort_key: overrides.title_sort_key ?? title.normalize("NFKC").toLowerCase(),
    title_provenance: "retrieved",
    retrieved_title_candidate: null,
    description: `A deterministic description for bookmark ${id}.`,
    description_provenance: "retrieved",
    retrieved_description_candidate: null,
    icon_hash: null,
    metadata_status: "complete",
    metadata_error_code: null,
    metadata_fetched_at: DEFAULT_TEST_TIME,
    note_markdown: "",
    note_plain: "",
    is_favorite: 0,
    is_unread: 0,
    archived_at: null,
    created_at: DEFAULT_TEST_TIME,
    updated_at: DEFAULT_TEST_TIME,
    ...overrides,
  };
}

export function makeSearchCriteria(
  overrides: Partial<SearchCriteriaFixture> = {},
): SearchCriteriaFixture {
  return {
    scope: "active",
    query: "",
    favorite: null,
    unread: null,
    sort: "created_desc",
    ...overrides,
    tags: overrides.tags ? [...overrides.tags] : [],
  };
}

export function makeSavedView(overrides: Partial<SavedViewFixture> = {}): SavedViewFixture {
  const id = overrides.id ?? 1;
  return {
    ...makeSearchCriteria(overrides),
    id,
    name: overrides.name ?? `Saved view ${id}`,
    grammarVersion: 1,
    createdAt: DEFAULT_TEST_TIME,
    updatedAt: DEFAULT_TEST_TIME,
    ...overrides,
    tags: overrides.tags ? [...overrides.tags] : [],
  };
}

export function makeSelection(overrides: Partial<SelectionFixture> = {}): SelectionFixture {
  return {
    id: "selection-00000001",
    selectedCount: 1,
    criteriaHash: "sha256:deterministic-criteria-hash",
    expiresAt: "2026-01-02T03:19:05.000Z",
    ...overrides,
  };
}

export interface EntityFactories {
  bookmark: (overrides?: Partial<BookmarkFixture>) => BookmarkFixture;
  bookmarkRow: (overrides?: Partial<BookmarkRowFixture>) => BookmarkRowFixture;
  tag: (overrides?: Partial<TagFixture>) => TagFixture;
  savedView: (overrides?: Partial<SavedViewFixture>) => SavedViewFixture;
  selection: (overrides?: Partial<SelectionFixture>) => SelectionFixture;
  reset: () => void;
}

/** Returns sequence-backed factories for tests that need many distinct entities. */
export function createEntityFactories(): EntityFactories {
  let bookmarkId = 0;
  let tagId = 0;
  let savedViewId = 0;
  let selectionId = 0;

  return {
    bookmark: (overrides = {}) => makeBookmark({ id: ++bookmarkId, ...overrides }),
    bookmarkRow: (overrides = {}) => makeBookmarkRow({ id: ++bookmarkId, ...overrides }),
    tag: (overrides = {}) => makeTag({ id: ++tagId, ...overrides }),
    savedView: (overrides = {}) => makeSavedView({ id: ++savedViewId, ...overrides }),
    selection: (overrides = {}) =>
      makeSelection({ id: `selection-${String(++selectionId).padStart(8, "0")}`, ...overrides }),
    reset: () => {
      bookmarkId = 0;
      tagId = 0;
      savedViewId = 0;
      selectionId = 0;
    },
  };
}

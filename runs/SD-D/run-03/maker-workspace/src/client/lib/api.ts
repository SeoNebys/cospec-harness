import type {
  Bookmark,
  BookmarkCreate,
  BookmarkPage,
  BookmarkPatch,
  BulkAction,
  BulkResult,
  HealthResponse,
  MetadataPreview,
  MetadataRefreshResponse,
  SavedView,
  SavedViewWrite,
  Scope,
  SearchCriteria,
  Selection,
  SelectionCreate,
  SortOrder,
  Tag,
  TagSummary,
} from "../../shared/contracts/api";
import type {
  Problem as BaseProblem,
  DuplicateBookmarkProblem,
  DuplicateSavedViewProblem,
  SearchProblem,
} from "../../shared/contracts/errors";

export type {
  Bookmark,
  BookmarkCreate,
  BookmarkPage,
  BookmarkPatch,
  BulkAction,
  BulkResult,
  MetadataPreview,
  SavedView,
  SavedViewWrite,
  Scope,
  SearchCriteria,
  Selection,
  SelectionCreate,
  SortOrder,
  Tag,
  TagSummary,
};

export type Problem =
  | BaseProblem
  | SearchProblem
  | DuplicateBookmarkProblem
  | DuplicateSavedViewProblem;

export type BookmarkQuery = Partial<SearchCriteria> & {
  cursor?: string;
  limit?: number;
};

export class ApiError extends Error {
  readonly status: number;
  readonly problem: Problem;

  constructor(status: number, problem: Problem) {
    super(problem.message);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
  }
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
}

export interface BookmarkApiClient {
  getHealth(options?: RequestOptions): Promise<HealthResponse>;
  previewMetadata(address: string, options?: RequestOptions): Promise<MetadataPreview>;
  listBookmarks(query?: BookmarkQuery, options?: RequestOptions): Promise<BookmarkPage>;
  createBookmark(input: BookmarkCreate, options?: RequestOptions): Promise<Bookmark>;
  getBookmark(bookmarkId: number, options?: RequestOptions): Promise<Bookmark>;
  updateBookmark(
    bookmarkId: number,
    input: BookmarkPatch,
    options?: RequestOptions,
  ): Promise<Bookmark>;
  deleteBookmark(bookmarkId: number, options?: RequestOptions): Promise<void>;
  refreshBookmarkMetadata(
    bookmarkId: number,
    options?: RequestOptions,
  ): Promise<MetadataRefreshResponse>;
  listTags(options?: RequestOptions): Promise<TagSummary[]>;
  createSelection(input: SelectionCreate, options?: RequestOptions): Promise<Selection>;
  clearSelection(selectionId: string, options?: RequestOptions): Promise<void>;
  applyBulkAction(
    selectionId: string,
    action: BulkAction,
    options?: RequestOptions,
  ): Promise<BulkResult>;
  listSavedViews(options?: RequestOptions): Promise<SavedView[]>;
  createSavedView(input: SavedViewWrite, options?: RequestOptions): Promise<SavedView>;
  updateSavedView(
    savedViewId: number,
    input: SavedViewWrite,
    options?: RequestOptions,
  ): Promise<SavedView>;
  deleteSavedView(savedViewId: number, options?: RequestOptions): Promise<void>;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

function queryString(query: BookmarkQuery): string {
  const parameters = new URLSearchParams();

  if (query.scope !== undefined) parameters.set("scope", query.scope);
  if (query.query) parameters.set("q", query.query);
  for (const tag of query.tags ?? []) parameters.append("tag", tag);
  if (query.favorite !== undefined && query.favorite !== null) {
    parameters.set("favorite", String(query.favorite));
  }
  if (query.unread !== undefined && query.unread !== null) {
    parameters.set("unread", String(query.unread));
  }
  if (query.sort !== undefined) parameters.set("sort", query.sort);
  if (query.cursor) parameters.set("cursor", query.cursor);
  if (query.limit !== undefined) parameters.set("limit", String(query.limit));

  const value = parameters.toString();
  return value ? `?${value}` : "";
}

function fallbackProblem(status: number, statusText: string): Problem {
  return {
    code: `HTTP_${status}`,
    message: statusText || "The request could not be completed.",
  };
}

function isProblem(value: unknown): value is Problem {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.code === "string" && typeof candidate.message === "string";
}

export function createApiClient(options: ApiClientOptions = {}): BookmarkApiClient {
  const baseUrl = (options.baseUrl ?? "/api").replace(/\/$/, "");
  const fetcher = options.fetch ?? globalThis.fetch;

  async function request<T>(
    path: string,
    init: RequestInit = {},
    requestOptions: RequestOptions = {},
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetcher(`${baseUrl}${path}`, {
      ...init,
      credentials: "same-origin",
      headers,
      ...(requestOptions.signal ? { signal: requestOptions.signal } : {}),
    });

    if (!response.ok) {
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        payload = undefined;
      }
      throw new ApiError(
        response.status,
        isProblem(payload) ? payload : fallbackProblem(response.status, response.statusText),
      );
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  const json = (value: unknown) => JSON.stringify(value);
  const mutation = (method: "POST" | "PATCH", body?: unknown): RequestInit => ({
    method,
    ...(body === undefined ? {} : { body: json(body) }),
  });

  return {
    getHealth: (requestOptions) => request("/health", {}, requestOptions),
    previewMetadata: (address, requestOptions) =>
      request("/metadata/preview", mutation("POST", { address }), requestOptions),
    listBookmarks: (query = {}, requestOptions) =>
      request(`/bookmarks${queryString(query)}`, {}, requestOptions),
    createBookmark: (input, requestOptions) =>
      request("/bookmarks", mutation("POST", input), requestOptions),
    getBookmark: (bookmarkId, requestOptions) =>
      request(`/bookmarks/${bookmarkId}`, {}, requestOptions),
    updateBookmark: (bookmarkId, input, requestOptions) =>
      request(`/bookmarks/${bookmarkId}`, mutation("PATCH", input), requestOptions),
    deleteBookmark: (bookmarkId, requestOptions) =>
      request(`/bookmarks/${bookmarkId}`, { method: "DELETE" }, requestOptions),
    refreshBookmarkMetadata: (bookmarkId, requestOptions) =>
      request(`/bookmarks/${bookmarkId}/metadata-refresh`, mutation("POST", {}), requestOptions),
    listTags: (requestOptions) => request("/tags", {}, requestOptions),
    createSelection: (input, requestOptions) =>
      request("/selections", mutation("POST", input), requestOptions),
    clearSelection: (selectionId, requestOptions) =>
      request(
        `/selections/${encodeURIComponent(selectionId)}`,
        { method: "DELETE" },
        requestOptions,
      ),
    applyBulkAction: (selectionId, action, requestOptions) =>
      request(
        `/selections/${encodeURIComponent(selectionId)}/actions`,
        mutation("POST", action),
        requestOptions,
      ),
    listSavedViews: (requestOptions) => request("/saved-views", {}, requestOptions),
    createSavedView: (input, requestOptions) =>
      request("/saved-views", mutation("POST", input), requestOptions),
    updateSavedView: (savedViewId, input, requestOptions) =>
      request(`/saved-views/${savedViewId}`, mutation("PATCH", input), requestOptions),
    deleteSavedView: (savedViewId, requestOptions) =>
      request(`/saved-views/${savedViewId}`, { method: "DELETE" }, requestOptions),
  };
}

export const api = createApiClient();

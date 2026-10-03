import type { Scope, SearchCriteria, SortOrder } from "./api";

export interface ViewState extends SearchCriteria {
  favorite: boolean | null;
  unread: boolean | null;
  bookmarkId: number | null;
  editing: boolean;
  savedViewId: number | null;
  cursor: string | null;
}

export const DEFAULT_VIEW_STATE: Readonly<ViewState> = {
  scope: "active",
  query: "",
  tags: [],
  favorite: null,
  unread: null,
  sort: "created_desc",
  bookmarkId: null,
  editing: false,
  savedViewId: null,
  cursor: null,
};

const scopes = new Set<Scope>(["active", "read_later", "archived"]);
const sorts = new Set<SortOrder>(["created_desc", "created_asc", "updated_desc", "title_asc"]);

function nullableBoolean(value: string | null): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function positiveInteger(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const result = Number(value);
  return Number.isSafeInteger(result) && result > 0 ? result : null;
}

export function parseViewState(input: string | URLSearchParams): ViewState {
  const parameters =
    typeof input === "string"
      ? new URLSearchParams(input.startsWith("?") ? input.slice(1) : input)
      : input;
  const scopeValue = parameters.get("scope") as Scope | null;
  const sortValue = parameters.get("sort") as SortOrder | null;
  const bookmarkId = positiveInteger(parameters.get("bookmark"));

  return {
    scope: scopeValue && scopes.has(scopeValue) ? scopeValue : DEFAULT_VIEW_STATE.scope,
    query: parameters.get("q") ?? DEFAULT_VIEW_STATE.query,
    tags: Array.from(
      new Set(
        parameters
          .getAll("tag")
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    ),
    favorite: nullableBoolean(parameters.get("favorite")),
    unread: nullableBoolean(parameters.get("unread")),
    sort: sortValue && sorts.has(sortValue) ? sortValue : DEFAULT_VIEW_STATE.sort,
    bookmarkId,
    editing: bookmarkId !== null && parameters.get("edit") === "true",
    savedViewId: positiveInteger(parameters.get("view")),
    cursor: parameters.get("cursor") || null,
  };
}

export function viewStateToSearchParams(state: ViewState): URLSearchParams {
  const parameters = new URLSearchParams();

  if (state.scope !== DEFAULT_VIEW_STATE.scope) parameters.set("scope", state.scope);
  if (state.query) parameters.set("q", state.query);
  for (const tag of state.tags) parameters.append("tag", tag);
  if (state.favorite !== null) parameters.set("favorite", String(state.favorite));
  if (state.unread !== null) parameters.set("unread", String(state.unread));
  if (state.sort !== DEFAULT_VIEW_STATE.sort) parameters.set("sort", state.sort);
  if (state.bookmarkId !== null) parameters.set("bookmark", String(state.bookmarkId));
  if (state.editing && state.bookmarkId !== null) parameters.set("edit", "true");
  if (state.savedViewId !== null) parameters.set("view", String(state.savedViewId));
  if (state.cursor) parameters.set("cursor", state.cursor);

  return parameters;
}

export function serializeViewState(state: ViewState): string {
  const value = viewStateToSearchParams(state).toString();
  return value ? `?${value}` : "";
}

export function readViewState(location: Pick<Location, "search"> = window.location): ViewState {
  return parseViewState(location.search);
}

export function viewStateHref(
  state: ViewState,
  location: Pick<Location, "pathname" | "hash"> = window.location,
): string {
  return `${location.pathname}${serializeViewState(state)}${location.hash}`;
}

export function writeViewState(
  state: ViewState,
  mode: "push" | "replace" = "push",
  history: Pick<History, "pushState" | "replaceState"> = window.history,
): void {
  const method =
    mode === "replace" ? history.replaceState.bind(history) : history.pushState.bind(history);
  method(null, "", viewStateHref(state));
  window.dispatchEvent(new CustomEvent("bookmark-garden:view-state"));
}

export function subscribeToViewState(listener: (state: ViewState) => void): () => void {
  const handleChange = () => listener(readViewState());
  window.addEventListener("popstate", handleChange);
  window.addEventListener("bookmark-garden:view-state", handleChange);
  return () => {
    window.removeEventListener("popstate", handleChange);
    window.removeEventListener("bookmark-garden:view-state", handleChange);
  };
}

export function criteriaFromViewState(state: ViewState): SearchCriteria {
  return {
    scope: state.scope,
    query: state.query,
    tags: [...state.tags],
    favorite: state.favorite,
    unread: state.unread,
    sort: state.sort,
  };
}

export function resetPagination(state: ViewState): ViewState {
  return { ...state, cursor: null };
}

export function withScope(state: ViewState, scope: Scope): ViewState {
  return {
    ...state,
    scope,
    bookmarkId: null,
    editing: false,
    savedViewId: null,
    cursor: null,
  };
}

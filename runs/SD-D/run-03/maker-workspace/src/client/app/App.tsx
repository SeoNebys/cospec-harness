import { Component, type ErrorInfo, type ReactNode, useEffect, useRef, useState } from "react";
import { Button, Dialog, EmptyState, Status } from "../components";
import { BookmarkDetail } from "../features/bookmarks/BookmarkDetail";
import { BookmarkList } from "../features/bookmarks/BookmarkList";
import { DeleteBookmarkDialog } from "../features/bookmarks/DeleteBookmarkDialog";
import { CaptureForm } from "../features/capture/CaptureForm";
import { SavedViewDialog } from "../features/saved-views/SavedViewDialog";
import { SavedViewList } from "../features/saved-views/SavedViewList";
import { applySavedViewToViewState, useSavedViews } from "../features/saved-views/useSavedViews";
import { SearchControls } from "../features/search/SearchControls";
import { BulkActionBar } from "../features/selection/BulkActionBar";
import { SelectionControls } from "../features/selection/SelectionControls";
import {
  api,
  type Bookmark,
  type BookmarkPage,
  type BulkAction,
  type BulkResult,
  type SavedView,
  type Scope,
  type Selection,
  type TagSummary,
} from "../lib/api";
import {
  criteriaFromViewState,
  readViewState,
  subscribeToViewState,
  type ViewState,
  viewStateHref,
  withScope,
  writeViewState,
} from "../lib/view-state";

type StartupState = "loading" | "ready" | "error";

const scopeCopy = {
  active: {
    label: "Bookmarks",
    eyebrow: "Your collection",
    title: "A calmer place for the links worth keeping.",
    emptyTitle: "Your bookmark garden is ready",
    emptyDescription:
      "Paste a web address to save it. Page details will be gathered automatically when possible.",
  },
  read_later: {
    label: "Read later",
    eyebrow: "Reading queue",
    title: "Keep the next good read within reach.",
    emptyTitle: "Nothing waiting to be read",
    emptyDescription:
      "Bookmarks marked Read Later appear here while keeping their favorite status separate.",
  },
  archived: {
    label: "Archive",
    eyebrow: "Out of the way, not gone",
    title: "A quiet shelf for links you may need again.",
    emptyTitle: "Your archive is empty",
    emptyDescription: "Archived bookmarks will stay here with their tags and reading state intact.",
  },
} as const;

interface ErrorBoundaryState {
  failed: boolean;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error("Application render failed", error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="fatal-state" role="alert">
          <p className="eyebrow">Something went wrong</p>
          <h1>The bookmark garden could not be displayed.</h1>
          <p>Your bookmarks have not been changed. Reload the page to try again.</p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload app
          </Button>
        </main>
      );
    }
    return this.props.children;
  }
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 36 36" focusable="false">
        <title>Bookmark Garden</title>
        <path d="M18 31V16" />
        <path d="M18 21c-6.2 0-10-3.4-10-9 6.2 0 10 3.4 10 9Z" />
        <path d="M18 16c5.7 0 9.2-3.1 9.2-8.2C21.5 7.8 18 10.9 18 16Z" />
        <path d="M11 31h14" />
      </svg>
    </span>
  );
}

function LoadingShell() {
  return (
    <div
      className="startup-state"
      role="status"
      aria-busy="true"
      aria-label="Loading Bookmark Garden"
    >
      <BrandMark />
      <p>Preparing your collection…</p>
    </div>
  );
}

function StartupError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="fatal-state" role="alert">
      <p className="eyebrow">Unable to connect</p>
      <h1>Your bookmark collection is not available yet.</h1>
      <p>Nothing was changed. Check that the app is running, then try again.</p>
      <Button variant="primary" onClick={onRetry}>
        Try again
      </Button>
    </main>
  );
}

export function App() {
  const [startup, setStartup] = useState<StartupState>("loading");
  const [view, setView] = useState<ViewState>(() => readViewState());
  const [collection, setCollection] = useState<BookmarkPage | null>(null);
  const [collectionError, setCollectionError] = useState(false);
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [readLaterCount, setReadLaterCount] = useState<number | null>(null);
  const [readingFeedback, setReadingFeedback] = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [savedViewDialogOpen, setSavedViewDialogOpen] = useState(false);
  const [editingSavedView, setEditingSavedView] = useState<SavedView | undefined>();
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);
  const [deletingBookmark, setDeletingBookmark] = useState<Bookmark | null>(null);
  const [bulkSelection, setBulkSelection] = useState<Selection | null>(null);
  const [selectionEpoch, setSelectionEpoch] = useState(0);
  const captureAddressRef = useRef<HTMLInputElement>(null);
  const captureReturnFocusRef = useRef<HTMLElement | null>(null);
  const readingFeedbackRef = useRef<HTMLDivElement>(null);
  const savedViews = useSavedViews();

  useEffect(() => subscribeToViewState(setView), []);

  useEffect(() => {
    const controller = new AbortController();
    setStartup("loading");
    api
      .getHealth({ signal: controller.signal })
      .then(() => setStartup("ready"))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setStartup("error");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (startup !== "ready") return;
    const controller = new AbortController();
    setCollection(null);
    setCollectionError(false);
    api
      .listBookmarks(
        {
          scope: view.scope,
          query: view.query,
          tags: view.tags,
          favorite: view.favorite,
          unread: view.unread,
          sort: view.sort,
          ...(view.cursor ? { cursor: view.cursor } : {}),
        },
        { signal: controller.signal },
      )
      .then(setCollection)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setCollectionError(true);
        }
      });
    return () => controller.abort();
  }, [startup, view]);

  useEffect(() => {
    if (startup !== "ready") return;
    const controller = new AbortController();
    api
      .listTags({ signal: controller.signal })
      .then(setTags)
      .catch(() => setTags([]));
    return () => controller.abort();
  }, [startup]);

  useEffect(() => {
    if (startup !== "ready") return;
    const controller = new AbortController();
    api
      .listBookmarks({ scope: "read_later", limit: 1 }, { signal: controller.signal })
      .then((page) => setReadLaterCount(page.total))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setReadLaterCount(null);
        }
      });
    return () => controller.abort();
  }, [startup]);

  useEffect(() => {
    if (startup !== "ready" || view.bookmarkId === null) return;
    if (selectedBookmark?.id === view.bookmarkId) return;
    const fromPage = collection?.items.find((bookmark) => bookmark.id === view.bookmarkId);
    if (fromPage) {
      setSelectedBookmark(fromPage);
      return;
    }
    const controller = new AbortController();
    api
      .getBookmark(view.bookmarkId, { signal: controller.signal })
      .then(setSelectedBookmark)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setSelectedBookmark(null);
        }
      });
    return () => controller.abort();
  }, [collection, selectedBookmark?.id, startup, view.bookmarkId]);

  function navigate(scope: ViewState["scope"]) {
    setSelectedBookmark(null);
    const next = withScope(view, scope);
    writeViewState(next);
  }

  function updateView(next: ViewState) {
    setSelectedBookmark(null);
    writeViewState({ ...next, bookmarkId: null, editing: false });
  }

  function openBookmark(bookmark: Bookmark, editing = false) {
    setSelectedBookmark(bookmark);
    writeViewState({ ...view, bookmarkId: bookmark.id, editing });
  }

  function closeBookmark() {
    setSelectedBookmark(null);
    writeViewState({ ...view, bookmarkId: null, editing: false }, "replace");
  }

  function handleSaved(bookmark: Bookmark) {
    setCaptureOpen(false);
    if (view.scope === "active") {
      setCollection((current) =>
        current
          ? { ...current, items: [bookmark, ...current.items], total: current.total + 1 }
          : current,
      );
    }
    if (bookmark.unread && !bookmark.archived) {
      setReadLaterCount((current) => (current === null ? 1 : current + 1));
    }
    openBookmark(bookmark);
  }

  function openCapture() {
    captureReturnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCaptureOpen(true);
  }

  function closeCapture() {
    setCaptureOpen(false);
    queueMicrotask(() => {
      if (captureReturnFocusRef.current?.isConnected) captureReturnFocusRef.current.focus();
    });
  }

  async function handleToggleReadLater(bookmark: Bookmark, unread: boolean) {
    const updated = await api.updateBookmark(bookmark.id, { unread });
    setCollection((current) => {
      if (!current) return current;
      if (view.scope === "read_later" && !updated.unread) {
        return {
          ...current,
          items: current.items.filter((item) => item.id !== bookmark.id),
          total: Math.max(0, current.total - 1),
        };
      }
      return {
        ...current,
        items: current.items.map((item) => (item.id === bookmark.id ? updated : item)),
      };
    });
    setSelectedBookmark((current) => (current?.id === bookmark.id ? updated : current));
    setReadLaterCount((current) => {
      if (current === null) return unread ? 1 : 0;
      return Math.max(0, current + (unread ? 1 : -1));
    });
    setReadingFeedback(
      unread
        ? `${bookmark.title} was added to Read Later.`
        : `${bookmark.title} was marked as read.`,
    );
    if (view.scope === "read_later" && !unread) {
      window.requestAnimationFrame(() => readingFeedbackRef.current?.focus());
    }
  }

  function handleBookmarkUpdated(updated: Bookmark, outcome?: string) {
    const previous = selectedBookmark;
    setSelectedBookmark(updated);
    setCollection((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => (item.id === updated.id ? updated : item)),
          }
        : current,
    );

    if (previous && previous.archived !== updated.archived) {
      if (updated.unread) {
        setReadLaterCount((current) => {
          const change = updated.archived ? -1 : 1;
          return Math.max(0, (current ?? 0) + change);
        });
      }
      const targetScope: Scope = updated.archived
        ? "archived"
        : updated.unread
          ? "read_later"
          : "active";
      const next = withScope(view, targetScope);
      writeViewState({ ...next, bookmarkId: updated.id, editing: false });
      return;
    }

    if (view.editing || outcome === "Bookmark changes saved.") {
      writeViewState({ ...view, bookmarkId: updated.id, editing: false }, "replace");
    }
  }

  function startEditing() {
    if (!selectedBookmark) return;
    writeViewState({ ...view, bookmarkId: selectedBookmark.id, editing: true }, "replace");
  }

  function cancelEditing() {
    writeViewState({ ...view, editing: false }, "replace");
  }

  function handleDuplicate(bookmarkId: number, scope?: Scope) {
    setCaptureOpen(false);
    const next = {
      ...view,
      scope: scope ?? view.scope,
      bookmarkId,
      editing: true,
      cursor: null,
    };
    writeViewState(next);
  }

  function openSavedView(saved: SavedView) {
    setSelectedBookmark(null);
    writeViewState(applySavedViewToViewState(saved, view));
  }

  async function deleteSavedView(saved: SavedView) {
    await savedViews.remove(saved);
    if (view.savedViewId === saved.id) {
      writeViewState({ ...view, savedViewId: null }, "replace");
    }
  }

  function clearBulkSelection() {
    setBulkSelection(null);
    setSelectionEpoch((current) => current + 1);
  }

  function refreshCollectionData() {
    setView((current) => ({ ...current }));
    void api
      .listTags()
      .then(setTags)
      .catch(() => setTags([]));
    void api
      .listBookmarks({ scope: "read_later", limit: 1 })
      .then((page) => setReadLaterCount(page.total))
      .catch(() => setReadLaterCount(null));
  }

  function handleBulkComplete(result: BulkResult, action: BulkAction) {
    refreshCollectionData();
    setReadingFeedback(
      `Bulk action ${action.type.replaceAll("_", " ")} processed ${result.processedCount} bookmark${
        result.processedCount === 1 ? "" : "s"
      } and changed ${result.changedCount}.`,
    );
  }

  function handleBookmarkDeleted(bookmarkId: number, announcement: string) {
    const deleted = deletingBookmark;
    setDeletingBookmark(null);
    setSelectedBookmark(null);
    setCollection((current) =>
      current
        ? {
            ...current,
            items: current.items.filter((item) => item.id !== bookmarkId),
            total: current.items.some((item) => item.id === bookmarkId)
              ? Math.max(0, current.total - 1)
              : current.total,
          }
        : current,
    );
    if (deleted?.unread && !deleted.archived) {
      setReadLaterCount((current) => Math.max(0, (current ?? 1) - 1));
    }
    setReadingFeedback(announcement);
    writeViewState({ ...view, bookmarkId: null, editing: false }, "replace");
    refreshCollectionData();
    window.requestAnimationFrame(() => readingFeedbackRef.current?.focus());
  }

  if (startup === "loading") return <LoadingShell />;
  if (startup === "error") return <StartupError onRetry={() => window.location.reload()} />;

  const copy = scopeCopy[view.scope];
  const hasCriteria = Boolean(
    view.query || view.tags.length || view.favorite !== null || view.unread !== null,
  );

  return (
    <div className="app-shell" data-harness-ready={collection !== null ? "true" : undefined}>
      <a className="skip-link" href="#main-content">
        Skip to collection
      </a>
      <header className="site-header">
        <a
          className="brand"
          href={viewStateHref(withScope(view, "active"))}
          onClick={(event) => {
            event.preventDefault();
            navigate("active");
          }}
        >
          <BrandMark />
          <span>
            <strong>Bookmark Garden</strong>
            <small>Links, thoughtfully kept</small>
          </span>
        </a>
        <div className="header-actions">
          <Button variant="primary" onClick={openCapture}>
            <span aria-hidden="true">＋</span> Add bookmark
          </Button>
        </div>
      </header>

      <div className="app-layout">
        <aside className="sidebar" aria-label="Collection navigation">
          <nav>
            <p className="nav-label">Library</p>
            <ul className="nav-list">
              {(Object.keys(scopeCopy) as ViewState["scope"][]).map((scope) => (
                <li key={scope}>
                  <a
                    href={viewStateHref(withScope(view, scope))}
                    className={view.scope === scope ? "nav-link nav-link--active" : "nav-link"}
                    aria-current={view.scope === scope ? "page" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(scope);
                    }}
                  >
                    <span>{scopeCopy[scope].label}</span>
                    {scope === "read_later" && readLaterCount !== null ? (
                      <span className="nav-count">
                        <span aria-hidden="true">{readLaterCount}</span>
                        <span className="visually-hidden">
                          {readLaterCount} unread bookmark{readLaterCount === 1 ? "" : "s"}
                        </span>
                      </span>
                    ) : null}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <section className="saved-views-nav" aria-labelledby="saved-views-title">
            <div className="saved-views-nav__heading">
              <p className="nav-label" id="saved-views-title">
                Saved views
              </p>
              <Button
                size="small"
                variant="quiet"
                onClick={() => {
                  setEditingSavedView(undefined);
                  setSavedViewDialogOpen(true);
                }}
              >
                Save current
              </Button>
            </div>
            {savedViews.loading ? (
              <span className="saved-views-loading">Loading…</span>
            ) : (
              <SavedViewList
                views={savedViews.views}
                activeId={view.savedViewId}
                onOpen={openSavedView}
                onEdit={(saved) => {
                  setEditingSavedView(saved);
                  setSavedViewDialogOpen(true);
                }}
                onDelete={deleteSavedView}
              />
            )}
            {savedViews.error ? (
              <span className="saved-views-error">{savedViews.error}</span>
            ) : null}
          </section>
          <div className="sidebar-note">
            <span aria-hidden="true">✦</span>
            <p>Saved views will keep your favorite searches close at hand.</p>
          </div>
        </aside>

        <main id="main-content" className="main-content" tabIndex={-1}>
          <div
            ref={readingFeedbackRef}
            className="reading-feedback"
            role="status"
            aria-label="Reading list update"
            aria-live="polite"
            aria-atomic="true"
            tabIndex={-1}
          >
            {readingFeedback}
          </div>
          <section className="page-heading">
            <div>
              <p className="eyebrow">{copy.eyebrow}</p>
              <h1>{copy.title}</h1>
            </div>
            <Status live="off">Ready for your links</Status>
          </section>

          <SearchControls
            view={view}
            tags={tags}
            total={collection?.total ?? 0}
            onChange={updateView}
          />

          <section className="collection-panel" aria-labelledby="collection-title">
            <div className="collection-panel__header">
              <div>
                <p className="eyebrow">Current view</p>
                <h2 id="collection-title">{copy.label}</h2>
              </div>
              <span className="result-count">
                {collection
                  ? `${collection.total} bookmark${collection.total === 1 ? "" : "s"}`
                  : ""}
              </span>
            </div>
            {collectionError ? (
              <EmptyState
                title="This collection could not be loaded"
                description="Your bookmarks have not been changed. Reload the page to try again."
                action={<Button onClick={() => window.location.reload()}>Reload</Button>}
              />
            ) : collection === null ? (
              <div className="collection-loading" role="status" aria-live="polite">
                Loading bookmarks…
              </div>
            ) : collection.items.length ? (
              <>
                <SelectionControls
                  key={selectionEpoch}
                  visibleBookmarks={collection.items}
                  totalResults={collection.total}
                  criteria={criteriaFromViewState(view)}
                  onSelectionChange={setBulkSelection}
                />
                {bulkSelection ? (
                  <BulkActionBar
                    selection={bulkSelection}
                    onComplete={handleBulkComplete}
                    onClear={clearBulkSelection}
                    onExpired={clearBulkSelection}
                  />
                ) : null}
                <BookmarkList
                  bookmarks={collection.items}
                  onOpen={openBookmark}
                  onToggleReadLater={view.scope === "archived" ? undefined : handleToggleReadLater}
                />
                {collection.nextCursor ? (
                  <div className="collection-pagination">
                    <Button onClick={() => updateView({ ...view, cursor: collection.nextCursor })}>
                      Load more results
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyState
                title={hasCriteria ? "No bookmarks match this view" : copy.emptyTitle}
                description={
                  hasCriteria
                    ? "Try removing a filter or simplifying the search expression."
                    : copy.emptyDescription
                }
                icon={<BrandMark />}
                action={
                  hasCriteria ? (
                    <Button
                      onClick={() =>
                        updateView({
                          ...view,
                          query: "",
                          tags: [],
                          favorite: null,
                          unread: null,
                          cursor: null,
                        })
                      }
                    >
                      Clear search and filters
                    </Button>
                  ) : view.scope === "active" ? (
                    <Button variant="primary" onClick={openCapture}>
                      Add your first bookmark
                    </Button>
                  ) : view.scope === "read_later" ? (
                    <Button onClick={() => navigate("active")}>Browse bookmarks</Button>
                  ) : view.scope === "archived" ? (
                    <Button onClick={() => navigate("active")}>Browse bookmarks</Button>
                  ) : undefined
                }
              />
            )}
          </section>
        </main>
      </div>

      <footer className="site-footer">
        <p>Your collection stays on this app installation.</p>
      </footer>

      <Dialog
        open={captureOpen}
        title="Save a bookmark"
        description="Paste an address and save right away. Page details will arrive automatically when available."
        onClose={closeCapture}
        initialFocusRef={captureAddressRef}
      >
        <CaptureForm
          addressInputRef={captureAddressRef}
          onSaved={handleSaved}
          onDuplicate={handleDuplicate}
          onCancel={closeCapture}
        />
      </Dialog>

      {selectedBookmark ? (
        <BookmarkDetail
          bookmark={selectedBookmark}
          editing={view.editing}
          onClose={closeBookmark}
          onEdit={startEditing}
          onCancelEdit={cancelEditing}
          onUpdated={handleBookmarkUpdated}
          onDuplicate={handleDuplicate}
          onRequestDelete={setDeletingBookmark}
        />
      ) : null}

      {deletingBookmark ? (
        <DeleteBookmarkDialog
          open
          bookmark={deletingBookmark}
          onClose={() => setDeletingBookmark(null)}
          onDeleted={handleBookmarkDeleted}
        />
      ) : null}

      <SavedViewDialog
        open={savedViewDialogOpen}
        criteria={criteriaFromViewState(view)}
        {...(editingSavedView ? { existing: editingSavedView } : {})}
        onSaved={savedViews.upsert}
        onClose={() => {
          setSavedViewDialogOpen(false);
          setEditingSavedView(undefined);
        }}
      />
    </div>
  );
}

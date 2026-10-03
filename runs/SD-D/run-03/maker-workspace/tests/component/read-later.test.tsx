// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/client/app/App";
import { BookmarkCard } from "../../src/client/features/bookmarks/BookmarkCard";
import { CaptureForm } from "../../src/client/features/capture/CaptureForm";
import type { Bookmark, BookmarkApiClient } from "../../src/client/lib/api";
import { api } from "../../src/client/lib/api";

const favoriteBookmark: Bookmark = {
  id: 31,
  address: "https://example.com/long-read",
  title: "A long read",
  titleProvenance: "retrieved",
  description: "An essay saved for later.",
  descriptionProvenance: "retrieved",
  iconUrl: null,
  metadataStatus: "complete",
  noteMarkdown: "",
  tags: [{ id: 4, name: "essays" }],
  favorite: true,
  unread: false,
  archived: false,
  createdAt: "2026-09-17T09:30:00.000Z",
  updatedAt: "2026-09-17T09:30:00.000Z",
};

function captureClient(overrides: Partial<BookmarkApiClient> = {}): BookmarkApiClient {
  return {
    getHealth: vi.fn(),
    previewMetadata: vi.fn(() => new Promise(() => undefined)),
    listBookmarks: vi.fn(),
    createBookmark: vi
      .fn()
      .mockResolvedValue({ ...favoriteBookmark, unread: true, favorite: false }),
    getBookmark: vi.fn(),
    updateBookmark: vi.fn(),
    deleteBookmark: vi.fn(),
    refreshBookmarkMetadata: vi.fn(),
    listTags: vi.fn(),
    createSelection: vi.fn(),
    clearSelection: vi.fn(),
    applyBulkAction: vi.fn(),
    listSavedViews: vi.fn(),
    createSavedView: vi.fn(),
    updateSavedView: vi.fn(),
    deleteSavedView: vi.fn(),
    ...overrides,
  } as BookmarkApiClient;
}

function setupApp(bookmarks: Bookmark[] = [favoriteBookmark]) {
  vi.spyOn(api, "getHealth").mockResolvedValue({ status: "ready" });
  vi.spyOn(api, "listTags").mockResolvedValue([]);
  const listBookmarks = vi.spyOn(api, "listBookmarks").mockImplementation(async (query = {}) => {
    if (query.scope === "read_later") {
      const items = bookmarks.filter((bookmark) => bookmark.unread && !bookmark.archived);
      return { items, total: items.length, nextCursor: null };
    }
    return { items: bookmarks, total: bookmarks.length, nextCursor: null };
  });
  return { listBookmarks };
}

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("Read Later capture and card controls", () => {
  it("saves the capture-time Read Later choice independently from favorite", async () => {
    const createBookmark = vi.fn().mockResolvedValue({
      ...favoriteBookmark,
      unread: true,
      favorite: false,
    });
    const user = userEvent.setup();

    render(
      <CaptureForm
        client={captureClient({ createBookmark })}
        onSaved={vi.fn()}
        onDuplicate={vi.fn()}
      />,
    );
    await user.type(
      screen.getByRole("textbox", { name: /web address/i }),
      favoriteBookmark.address,
    );
    await user.click(screen.getByRole("checkbox", { name: /read later/i }));
    await user.click(screen.getByRole("button", { name: /save bookmark/i }));

    await waitFor(() =>
      expect(createBookmark).toHaveBeenCalledWith(
        expect.objectContaining({ unread: true, favorite: false }),
        expect.anything(),
      ),
    );
  });

  it("exposes an accessible card toggle for either reading state", async () => {
    const onToggleReadLater = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { rerender } = render(
      <BookmarkCard
        bookmark={favoriteBookmark}
        onOpen={vi.fn()}
        onToggleReadLater={onToggleReadLater}
      />,
    );

    await user.click(screen.getByRole("button", { name: /add a long read to read later/i }));
    expect(onToggleReadLater).toHaveBeenCalledWith(favoriteBookmark, true);

    rerender(
      <BookmarkCard
        bookmark={{ ...favoriteBookmark, unread: true }}
        onOpen={vi.fn()}
        onToggleReadLater={onToggleReadLater}
      />,
    );
    expect(screen.getByRole("button", { name: /mark a long read as read/i })).toBeInTheDocument();
  });
});

describe("Read Later application view", () => {
  it("shows the unread count and loads searchable, filterable Read Later results", async () => {
    const unread = { ...favoriteBookmark, unread: true };
    const { listBookmarks } = setupApp([unread]);
    const user = userEvent.setup();
    render(<App />);

    const navigation = await screen.findByRole("navigation");
    const readLaterLink = within(navigation).getByRole("link", { name: /read later/i });
    await waitFor(() => expect(readLaterLink).toHaveTextContent("1"));
    expect(readLaterLink).toHaveAccessibleName(/1 unread bookmark/i);
    await user.click(readLaterLink);

    await waitFor(() =>
      expect(listBookmarks).toHaveBeenCalledWith(
        expect.objectContaining({ scope: "read_later" }),
        expect.anything(),
      ),
    );
    expect(await screen.findByRole("heading", { name: "Read later" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: /search bookmarks/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /favorite filter/i })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: unread.title })).toBeInTheDocument();
  });

  it("marks an active favorite for later without changing favorite state", async () => {
    setupApp();
    const updated = { ...favoriteBookmark, unread: true, updatedAt: "2026-09-17T10:00:00.000Z" };
    const updateBookmark = vi.spyOn(api, "updateBookmark").mockResolvedValue(updated);
    const user = userEvent.setup();
    render(<App />);

    const card = await screen.findByRole("article", { name: favoriteBookmark.title });
    await user.click(within(card).getByRole("button", { name: /add a long read to read later/i }));

    await waitFor(() => expect(updateBookmark).toHaveBeenCalledWith(31, { unread: true }));
    expect(within(card).getByText(/favorite/i)).toBeInTheDocument();
    expect(within(card).getByText("Read Later")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: /reading list update/i })).toHaveTextContent(
      /added.*read later/i,
    );
  });

  it("removes a read item, announces the change, and moves focus to persistent feedback", async () => {
    const unread = { ...favoriteBookmark, unread: true };
    setupApp([unread]);
    vi.spyOn(api, "updateBookmark").mockResolvedValue({ ...unread, unread: false });
    window.history.replaceState(null, "", "/?scope=read_later");
    const user = userEvent.setup();
    render(<App />);

    const card = await screen.findByRole("article", { name: unread.title });
    await user.click(within(card).getByRole("button", { name: /mark a long read as read/i }));

    expect(
      await screen.findByRole("heading", { name: /nothing waiting to be read/i }),
    ).toBeInTheDocument();
    const feedback = screen.getByRole("status", { name: /reading list update/i });
    expect(feedback).toHaveTextContent(/marked.*read/i);
    expect(feedback).toHaveFocus();
    expect(screen.getByRole("button", { name: /browse bookmarks/i })).toBeInTheDocument();
  });

  it("shows a distinct empty queue while preserving a no-match state for filters", async () => {
    setupApp([]);
    window.history.replaceState(null, "", "/?scope=read_later");
    const user = userEvent.setup();
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /nothing waiting to be read/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/bookmarks marked read later appear here/i)).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: /search bookmarks/i }), "missing");
    await user.click(screen.getByRole("button", { name: /^search$/i }));
    expect(
      await screen.findByRole("heading", { name: /no bookmarks match this view/i }),
    ).toBeInTheDocument();
  });
});

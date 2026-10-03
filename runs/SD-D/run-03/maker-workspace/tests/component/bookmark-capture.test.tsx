// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/client/app/App";
import { BookmarkDetail } from "../../src/client/features/bookmarks/BookmarkDetail";
import { BookmarkList } from "../../src/client/features/bookmarks/BookmarkList";
import { CaptureForm } from "../../src/client/features/capture/CaptureForm";
import type { Bookmark, BookmarkApiClient, MetadataPreview } from "../../src/client/lib/api";
import { ApiError, api } from "../../src/client/lib/api";

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

const retrievedPreview: MetadataPreview = {
  address: "https://example.com/article",
  status: "complete",
  fallbackTitle: "example.com/article",
  title: "A thoughtful article",
  description: "An introduction worth saving.",
  iconAvailable: true,
};

const bookmark: Bookmark = {
  id: 17,
  address: "https://example.com/article",
  title: "A thoughtful article",
  titleProvenance: "retrieved",
  description: "An introduction worth saving.",
  descriptionProvenance: "retrieved",
  iconUrl: "/api/bookmarks/17/icon",
  metadataStatus: "complete",
  noteMarkdown: "",
  tags: [
    { id: 1, name: "news" },
    { id: 2, name: "design" },
  ],
  favorite: true,
  unread: true,
  archived: false,
  createdAt: "2026-09-17T09:30:00.000Z",
  updatedAt: "2026-09-17T10:00:00.000Z",
};

function client(overrides: Partial<BookmarkApiClient> = {}): BookmarkApiClient {
  return {
    getHealth: vi.fn(),
    previewMetadata: vi.fn().mockResolvedValue(retrievedPreview),
    listBookmarks: vi.fn(),
    createBookmark: vi.fn().mockResolvedValue(bookmark),
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

describe("bookmark capture", () => {
  it("starts an automatic debounced preview after an address is pasted", async () => {
    const previewMetadata = vi.fn().mockResolvedValue(retrievedPreview);
    const apiClient = client({ previewMetadata });
    const user = userEvent.setup();

    render(<CaptureForm client={apiClient} onSaved={vi.fn()} onDuplicate={vi.fn()} />);

    const address = screen.getByRole("textbox", { name: /web address/i });
    await user.click(address);
    await user.paste("https://example.com/article");

    expect(await screen.findByText(/fetching page details/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(previewMetadata).toHaveBeenCalledWith(
        "https://example.com/article",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(await screen.findByDisplayValue("A thoughtful article")).toBeInTheDocument();
    expect(screen.getByDisplayValue("An introduction worth saving.")).toBeInTheDocument();
    expect(screen.getByText(/page details found/i)).toBeInTheDocument();
  });

  it("can save immediately with opt-in defaults while preview is still pending", async () => {
    const previewMetadata = vi.fn(() => new Promise<MetadataPreview>(() => undefined));
    const createBookmark = vi.fn().mockResolvedValue(bookmark);
    const apiClient = client({ previewMetadata, createBookmark });
    const onSaved = vi.fn();
    const user = userEvent.setup();

    render(<CaptureForm client={apiClient} onSaved={onSaved} onDuplicate={vi.fn()} />);
    await user.type(screen.getByRole("textbox", { name: /web address/i }), bookmark.address);
    await user.click(screen.getByRole("checkbox", { name: /read later/i }));
    await user.click(screen.getByRole("button", { name: /save bookmark/i }));

    await waitFor(() =>
      expect(createBookmark).toHaveBeenCalledWith(
        {
          address: bookmark.address,
          favorite: false,
          unread: true,
        },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(onSaved).toHaveBeenCalledWith(bookmark);
  });

  it("sends manual text overrides and never replaces them with a late preview", async () => {
    let finishPreview: ((value: MetadataPreview) => void) | undefined;
    const previewMetadata = vi.fn(
      () =>
        new Promise<MetadataPreview>((resolve) => {
          finishPreview = resolve;
        }),
    );
    const createBookmark = vi.fn().mockResolvedValue(bookmark);
    const user = userEvent.setup();

    render(
      <CaptureForm
        client={client({ previewMetadata, createBookmark })}
        onSaved={vi.fn()}
        onDuplicate={vi.fn()}
      />,
    );
    await user.type(screen.getByRole("textbox", { name: /web address/i }), bookmark.address);
    const title = screen.getByRole("textbox", { name: /^title/i });
    await user.type(title, "My own title");

    await waitFor(() => expect(previewMetadata).toHaveBeenCalled());
    finishPreview?.(retrievedPreview);
    await waitFor(() => expect(screen.getByDisplayValue("My own title")).toBeInTheDocument());
    expect(screen.queryByDisplayValue("A thoughtful article")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save bookmark/i }));
    await waitFor(() =>
      expect(createBookmark).toHaveBeenCalledWith(
        expect.objectContaining({ title: "My own title" }),
        expect.anything(),
      ),
    );
  });

  it("shows readable fallback and validation or retrieval errors", async () => {
    const fallback: MetadataPreview = {
      ...retrievedPreview,
      status: "failed",
      title: "example.com/article",
      description: "",
      iconAvailable: false,
      errorCode: "FETCH_FAILED",
    };
    const user = userEvent.setup();
    render(
      <CaptureForm
        client={client({ previewMetadata: vi.fn().mockResolvedValue(fallback) })}
        onSaved={vi.fn()}
        onDuplicate={vi.fn()}
      />,
    );

    await user.type(screen.getByRole("textbox", { name: /web address/i }), "not a website");
    await user.click(screen.getByRole("button", { name: /save bookmark/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/http.*https/i);

    await user.clear(screen.getByRole("textbox", { name: /web address/i }));
    await user.type(screen.getByRole("textbox", { name: /web address/i }), bookmark.address);
    expect(await screen.findByDisplayValue("example.com/article")).toBeInTheDocument();
    expect(screen.getByText(/saved with a fallback title/i)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /site icon unavailable/i })).toBeInTheDocument();
  });

  it("routes duplicate preview or save conflicts to the existing editor", async () => {
    const duplicate = new ApiError(409, {
      code: "DUPLICATE_BOOKMARK",
      message: "That address is already saved.",
      existingBookmarkId: 17,
      existingScope: "archived",
    });
    const onDuplicate = vi.fn();
    const user = userEvent.setup();
    render(
      <CaptureForm
        client={client({ previewMetadata: vi.fn().mockRejectedValue(duplicate) })}
        onSaved={vi.fn()}
        onDuplicate={onDuplicate}
      />,
    );

    await user.type(screen.getByRole("textbox", { name: /web address/i }), bookmark.address);
    await waitFor(() => expect(onDuplicate).toHaveBeenCalledWith(17, "archived"));
    expect(screen.getByRole("status")).toHaveTextContent(/opening the existing bookmark/i);
  });
});

describe("bookmark collection", () => {
  it("renders card content and opens destinations in a safe new tab", () => {
    render(<BookmarkList bookmarks={[bookmark]} onOpen={vi.fn()} />);
    const card = screen.getByRole("article", { name: bookmark.title });

    expect(within(card).getByText(bookmark.description)).toBeInTheDocument();
    expect(within(card).getByText("news")).toBeInTheDocument();
    expect(within(card).getByText(/favorite/i)).toBeInTheDocument();
    expect(within(card).getByText(/read later/i)).toBeInTheDocument();
    expect(within(card).getByText(/sep 17, 2026/i)).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /open destination/i })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(within(card).getByRole("link", { name: /open destination/i })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    expect(within(card).getByRole("img", { name: /site icon for/i })).toHaveAttribute(
      "src",
      bookmark.iconUrl,
    );
  });

  it("opens accessible detail content from a card", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<BookmarkList bookmarks={[bookmark]} onOpen={onOpen} />);

    await user.click(screen.getByRole("button", { name: bookmark.title }));
    expect(onOpen).toHaveBeenCalledWith(bookmark);

    rerender(<BookmarkDetail bookmark={bookmark} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: bookmark.title })).toBeInTheDocument();
    expect(screen.getByText(bookmark.address)).toBeInTheDocument();
    expect(screen.getByText("Created").nextElementSibling).toHaveTextContent(/sep 17, 2026/i);
    expect(screen.getByRole("link", { name: /open destination/i })).toHaveAttribute(
      "target",
      "_blank",
    );
  });
});

describe("capture in the application shell", () => {
  it("loads the active collection and opens the paste form from Add bookmark", async () => {
    vi.spyOn(api, "getHealth").mockResolvedValue({ status: "ready" });
    vi.spyOn(api, "listTags").mockResolvedValue([]);
    const listBookmarks = vi.spyOn(api, "listBookmarks").mockResolvedValue({
      items: [],
      total: 0,
      nextCursor: null,
    });
    const user = userEvent.setup();

    render(<App />);

    const add = await screen.findByRole("button", { name: /add bookmark/i });
    await waitFor(() =>
      expect(listBookmarks).toHaveBeenCalledWith(
        expect.objectContaining({ scope: "active" }),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    await user.click(add);

    expect(screen.getByRole("dialog", { name: /save a bookmark/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /web address/i })).toHaveFocus();
  });
});

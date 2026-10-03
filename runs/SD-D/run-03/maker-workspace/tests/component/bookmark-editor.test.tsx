// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/client/app/App";
import { BookmarkActions } from "../../src/client/features/bookmarks/BookmarkActions";
import { BookmarkDetail } from "../../src/client/features/bookmarks/BookmarkDetail";
import { BookmarkEditor } from "../../src/client/features/bookmarks/BookmarkEditor";
import { NoteEditor } from "../../src/client/features/bookmarks/NoteEditor";
import type { Bookmark, BookmarkApiClient, BookmarkPatch } from "../../src/client/lib/api";
import { api } from "../../src/client/lib/api";

const bookmark: Bookmark = {
  id: 42,
  address: "https://example.com/original",
  title: "Original title",
  titleProvenance: "user",
  retrievedTitleCandidate: "Retrieved title",
  description: "Original description",
  descriptionProvenance: "user",
  retrievedDescriptionCandidate: "Retrieved description",
  iconUrl: null,
  metadataStatus: "complete",
  noteMarkdown: "## Notes\n\nAlready **important**.",
  tags: [
    { id: 1, name: "Research" },
    { id: 2, name: "Reading" },
  ],
  favorite: true,
  unread: true,
  archived: false,
  createdAt: "2026-09-10T09:30:00.000Z",
  updatedAt: "2026-09-17T10:15:00.000Z",
};

function client(overrides: Partial<BookmarkApiClient> = {}): BookmarkApiClient {
  return {
    getHealth: vi.fn(),
    previewMetadata: vi.fn(),
    listBookmarks: vi.fn(),
    createBookmark: vi.fn(),
    getBookmark: vi.fn(),
    updateBookmark: vi.fn().mockResolvedValue(bookmark),
    deleteBookmark: vi.fn(),
    refreshBookmarkMetadata: vi
      .fn()
      .mockResolvedValue({ bookmarkId: bookmark.id, metadataStatus: "pending" }),
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

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("bookmark editor", () => {
  it("saves address, metadata, normalized tag entry, and note source", async () => {
    const updateBookmark = vi
      .fn()
      .mockImplementation(async (_id: number, patch: BookmarkPatch) => ({
        ...bookmark,
        ...patch,
        tags: (patch.tags ?? []).map((name, index) => ({ id: index + 10, name })),
      }));
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(
      <BookmarkEditor
        bookmark={bookmark}
        client={client({ updateBookmark })}
        onSaved={onSaved}
        onCancel={vi.fn()}
        onDuplicate={vi.fn()}
      />,
    );

    const address = screen.getByRole("textbox", { name: /web address/i });
    await user.clear(address);
    await user.type(address, "https://example.com/changed");
    const title = screen.getByRole("textbox", { name: /^title/i });
    await user.clear(title);
    await user.type(title, "Changed title");
    const description = screen.getByRole("textbox", { name: /^description/i });
    await user.clear(description);
    await user.type(description, "Changed description");
    const tags = screen.getByRole("textbox", { name: /tags/i });
    await user.clear(tags);
    await user.type(tags, "Research, design, RESEARCH");
    const note = screen.getByRole("textbox", { name: /note source/i });
    await user.clear(note);
    await user.type(note, "# New note");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(updateBookmark).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          address: "https://example.com/changed",
          title: "Changed title",
          description: "Changed description",
          tags: ["Research", "design"],
          noteMarkdown: "# New note",
        }),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it("offers retrieved candidates explicitly and cancel leaves the bookmark unchanged", async () => {
    const updateBookmark = vi.fn().mockResolvedValue(bookmark);
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <BookmarkEditor
        bookmark={bookmark}
        client={client({ updateBookmark })}
        onSaved={vi.fn()}
        onCancel={onCancel}
        onDuplicate={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /use retrieved title/i }));
    await user.click(screen.getByRole("button", { name: /use retrieved description/i }));
    expect(screen.getByRole("textbox", { name: /^title/i })).toHaveValue("Retrieved title");
    expect(screen.getByRole("textbox", { name: /^description/i })).toHaveValue(
      "Retrieved description",
    );
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(updateBookmark).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          acceptRetrievedTitle: true,
          acceptRetrievedDescription: true,
        }),
        expect.anything(),
      ),
    );

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("formatted note editor", () => {
  it("provides keyboard-safe formatting tools, source, preview, and format help", async () => {
    function NoteHarness() {
      const [value, setValue] = useState("selected words");
      return <NoteEditor value={value} onChange={setValue} />;
    }
    const user = userEvent.setup();
    render(<NoteHarness />);

    const source = screen.getByRole("textbox", {
      name: /note source/i,
    }) as HTMLTextAreaElement;
    source.focus();
    source.setSelectionRange(0, 8);
    await user.click(screen.getByRole("button", { name: /bold/i }));
    expect(source).toHaveValue("**selected** words");
    expect(source).toHaveFocus();

    await user.click(screen.getByRole("button", { name: /preview note/i }));
    expect(screen.getByText("selected", { selector: "strong" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /formatting help/i }));
    expect(screen.getByText(/headings, bold, italic/i)).toBeInTheDocument();
  });

  it("renders supported Markdown without executable HTML, images, or dangerous links", async () => {
    render(
      <NoteEditor
        value={
          "# Heading\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert(1))\n\n![pixel](https://bad.example/pixel.png)\n\n`code`"
        }
        onChange={vi.fn()}
        initialMode="preview"
      />,
    );

    expect(screen.getByRole("heading", { name: "Heading" })).toBeInTheDocument();
    expect(screen.getByText("code", { selector: "code" })).toBeInTheDocument();
    expect(document.querySelector("script")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "unsafe" })).not.toBeInTheDocument();
  });
});

describe("bookmark actions and detail", () => {
  it("toggles favorite, archives/restores without altering unread, and refreshes metadata with announcements", async () => {
    const updateBookmark = vi
      .fn()
      .mockImplementation(async (_id: number, patch: BookmarkPatch) => ({
        ...bookmark,
        ...patch,
      }));
    const refreshBookmarkMetadata = vi
      .fn()
      .mockResolvedValue({ bookmarkId: bookmark.id, metadataStatus: "pending" });
    const user = userEvent.setup();

    function ActionsHarness() {
      const [value, setValue] = useState(bookmark);
      return (
        <BookmarkActions
          bookmark={value}
          client={client({ updateBookmark, refreshBookmarkMetadata })}
          onUpdated={(updated) => setValue(updated)}
        />
      );
    }
    render(<ActionsHarness />);

    await user.click(screen.getByRole("button", { name: /remove from favorites/i }));
    await waitFor(() => expect(updateBookmark).toHaveBeenCalledWith(42, { favorite: false }));
    expect(screen.getByRole("status")).toHaveTextContent(/removed from favorites/i);

    await user.click(screen.getByRole("button", { name: /^archive bookmark$/i }));
    await waitFor(() => expect(updateBookmark).toHaveBeenCalledWith(42, { archived: true }));
    expect(screen.getByRole("button", { name: /restore bookmark/i })).toBeInTheDocument();
    expect(screen.getByText(/read later retained/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /restore bookmark/i }));
    await waitFor(() => expect(updateBookmark).toHaveBeenCalledWith(42, { archived: false }));
    await user.click(screen.getByRole("button", { name: /refresh page details/i }));
    await waitFor(() => expect(refreshBookmarkMetadata).toHaveBeenCalledWith(42));
    expect(screen.getByRole("status")).toHaveTextContent(/refresh started/i);
  });

  it("shows formatted notes and both creation and modification timestamps in detail", () => {
    render(
      <BookmarkDetail bookmark={bookmark} onClose={vi.fn()} onEdit={vi.fn()} onUpdated={vi.fn()} />,
    );

    const noteRegion = screen.getByRole("region", { name: "Notes" });
    expect(within(noteRegion).getByText("important", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Created").nextElementSibling).toHaveTextContent(/sep 10, 2026/i);
    expect(screen.getByText("Updated").nextElementSibling).toHaveTextContent(/sep 17, 2026/i);
    expect(screen.getByRole("button", { name: /edit bookmark/i })).toBeInTheDocument();
  });
});

describe("archived application flow", () => {
  it("restores an unread favorite from Archive back into Read Later with states retained", async () => {
    const archived = { ...bookmark, archived: true };
    const restored = { ...archived, archived: false };
    let isRestored = false;
    vi.spyOn(api, "getHealth").mockResolvedValue({ status: "ready" });
    vi.spyOn(api, "listTags").mockResolvedValue([]);
    vi.spyOn(api, "listBookmarks").mockImplementation(async (query = {}) => {
      if (query.scope === "archived") return { items: [archived], total: 1, nextCursor: null };
      if (query.scope === "read_later") {
        return isRestored
          ? { items: [restored], total: 1, nextCursor: null }
          : { items: [], total: 0, nextCursor: null };
      }
      return { items: [], total: 0, nextCursor: null };
    });
    vi.spyOn(api, "updateBookmark").mockImplementation(async () => {
      isRestored = true;
      return restored;
    });
    vi.spyOn(api, "refreshBookmarkMetadata").mockResolvedValue({
      bookmarkId: bookmark.id,
      metadataStatus: "pending",
    });
    window.history.replaceState(null, "", "/?scope=archived");
    const user = userEvent.setup();
    render(<App />);

    const card = await screen.findByRole("article", { name: archived.title });
    await user.click(within(card).getByRole("button", { name: archived.title }));
    await user.click(screen.getByRole("button", { name: /restore bookmark/i }));

    await waitFor(() => expect(api.updateBookmark).toHaveBeenCalledWith(42, { archived: false }));
    expect(await screen.findByRole("heading", { name: "Read later" })).toBeInTheDocument();
    expect(screen.getByText("★ Favorite")).toBeInTheDocument();
    expect(screen.getByText(/read later retained/i)).toBeInTheDocument();
  });
});

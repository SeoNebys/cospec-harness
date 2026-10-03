// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { BookmarkEditor } from "../../src/client/features/bookmarks/BookmarkEditor";
import { DeleteBookmarkDialog } from "../../src/client/features/bookmarks/DeleteBookmarkDialog";
import { ApiError, type Bookmark, type BookmarkApiClient } from "../../src/client/lib/api";

const bookmark: Bookmark = {
  id: 42,
  address: "https://example.com/original",
  title: "Original title",
  titleProvenance: "user",
  retrievedTitleCandidate: null,
  description: "Original description",
  descriptionProvenance: "user",
  retrievedDescriptionCandidate: null,
  iconUrl: null,
  metadataStatus: "complete",
  metadataErrorCode: null,
  noteMarkdown: "",
  tags: [{ id: 1, name: "Research" }],
  favorite: false,
  unread: false,
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
    deleteBookmark: vi.fn().mockResolvedValue(undefined),
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

describe("bookmark editor error recovery", () => {
  it("preserves every draft value, associates a field error, and permits retry", async () => {
    const updateBookmark = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError(422, {
          code: "TITLE_REQUIRED",
          message: "Enter a title for this bookmark.",
          field: "title",
        }),
      )
      .mockResolvedValueOnce({ ...bookmark, title: "Recovered title" });
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
    const title = screen.getByRole("textbox", { name: /^title/i });
    const description = screen.getByRole("textbox", { name: /^description/i });
    await user.clear(address);
    await user.type(address, "https://example.com/draft");
    await user.clear(title);
    await user.type(title, "Recovered title");
    await user.clear(description);
    await user.type(description, "Draft description");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/enter a title/i);
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(address).toHaveValue("https://example.com/draft");
    expect(title).toHaveValue("Recovered title");
    expect(description).toHaveValue("Draft description");

    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 42 })));
  });

  it("routes an archived duplicate to the existing editor without reporting a save", async () => {
    const updateBookmark = vi.fn().mockRejectedValue(
      new ApiError(409, {
        code: "DUPLICATE_BOOKMARK",
        message: "That address is already saved.",
        field: "address",
        existingBookmarkId: 99,
        existingScope: "archived",
      }),
    );
    const onDuplicate = vi.fn();
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(
      <BookmarkEditor
        bookmark={bookmark}
        client={client({ updateBookmark })}
        onSaved={onSaved}
        onCancel={vi.fn()}
        onDuplicate={onDuplicate}
      />,
    );

    const address = screen.getByRole("textbox", { name: /web address/i });
    await user.clear(address);
    await user.type(address, "https://example.com/existing");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(onDuplicate).toHaveBeenCalledWith(99, "archived"));
    expect(onSaved).not.toHaveBeenCalled();
    expect(address).toHaveValue("https://example.com/existing");
  });
});

describe("individual delete confirmation", () => {
  it("cancels without mutation and confirms with focus restoration and an announcement", async () => {
    const deleteBookmark = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    function Harness() {
      const [open, setOpen] = useState(false);
      const [announcement, setAnnouncement] = useState("");
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open delete confirmation
          </button>
          <DeleteBookmarkDialog
            open={open}
            bookmark={bookmark}
            client={client({ deleteBookmark })}
            onClose={() => setOpen(false)}
            onDeleted={(_id, message) => {
              setAnnouncement(message);
              setOpen(false);
            }}
          />
          <div role="status" aria-live="polite">
            {announcement}
          </div>
        </>
      );
    }
    render(<Harness />);

    const trigger = screen.getByRole("button", { name: /open delete confirmation/i });
    await user.click(trigger);
    expect(
      screen.getByRole("dialog", { name: /permanently delete original title/i }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /^cancel$/i })).toHaveFocus();
    expect(screen.queryByText(/1 bookmark/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(deleteBookmark).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: /delete bookmark/i }));
    await waitFor(() => expect(deleteBookmark).toHaveBeenCalledWith(42, expect.anything()));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Bookmark “Original title” permanently deleted.",
    );
  });

  it("stays open with an assertive error when deletion fails", async () => {
    const user = userEvent.setup();
    render(
      <DeleteBookmarkDialog
        open
        bookmark={bookmark}
        client={client({ deleteBookmark: vi.fn().mockRejectedValue(new Error("offline")) })}
        onClose={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /delete bookmark/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be deleted/i);
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("button", { name: /delete bookmark/i })).toBeEnabled();
  });
});

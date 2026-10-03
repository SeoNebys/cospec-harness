// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { BookmarkApiClient, SavedView, SearchCriteria } from "../../src/client/lib/api";
import { ApiError } from "../../src/client/lib/api";
import { SavedViewDialog } from "../../src/client/features/saved-views/SavedViewDialog";
import { SavedViewList } from "../../src/client/features/saved-views/SavedViewList";
import { applySavedViewToViewState } from "../../src/client/features/saved-views/useSavedViews";
import { DEFAULT_VIEW_STATE } from "../../src/client/lib/view-state";

const criteria: SearchCriteria = {
  scope: "archived",
  query: '"climate news" OR #research',
  tags: ["News", "Missing tag"],
  favorite: true,
  unread: null,
  sort: "title_asc",
};

const saved: SavedView = {
  ...criteria,
  id: 7,
  name: "Research watch",
  grammarVersion: 1,
  createdAt: "2026-09-17T12:00:00.000Z",
  updatedAt: "2026-09-17T12:00:00.000Z",
};

function client(overrides: Partial<BookmarkApiClient> = {}): BookmarkApiClient {
  return {
    getHealth: vi.fn(),
    previewMetadata: vi.fn(),
    listBookmarks: vi.fn(),
    createBookmark: vi.fn(),
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

describe("saved views", () => {
  it("creates a named view from the exact current criteria and reports name conflicts", async () => {
    const user = userEvent.setup();
    const createSavedView = vi.fn().mockRejectedValue(
      new ApiError(409, {
        code: "DUPLICATE_SAVED_VIEW_NAME",
        message: "That name already exists.",
        field: "name",
      }),
    );
    render(
      <SavedViewDialog
        open
        criteria={criteria}
        client={client({ createSavedView })}
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await user.type(screen.getByRole("textbox", { name: /view name/i }), "Research watch");
    await user.click(screen.getByRole("button", { name: /save view/i }));
    expect(createSavedView).toHaveBeenCalledWith(
      { ...criteria, name: "Research watch" },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/already exists/i);
  });

  it("renames or updates an existing view from current criteria", async () => {
    const user = userEvent.setup();
    const updateSavedView = vi.fn().mockResolvedValue({ ...saved, name: "Updated" });
    render(
      <SavedViewDialog
        open
        criteria={{ ...criteria, query: "current query" }}
        existing={saved}
        client={client({ updateSavedView })}
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const name = screen.getByRole("textbox", { name: /view name/i });
    await user.clear(name);
    await user.type(name, "Updated");
    await user.click(screen.getByRole("button", { name: /update view/i }));
    expect(updateSavedView).toHaveBeenCalledWith(
      saved.id,
      expect.objectContaining({ name: "Updated", query: "current query" }),
      expect.anything(),
    );
  });

  it("opens live criteria including a missing tag and clears prior selection/detail state", () => {
    expect(
      applySavedViewToViewState(saved, {
        ...DEFAULT_VIEW_STATE,
        bookmarkId: 99,
        editing: true,
        cursor: "old-page",
      }),
    ).toEqual(
      expect.objectContaining({
        scope: "archived",
        query: criteria.query,
        tags: ["News", "Missing tag"],
        savedViewId: 7,
        bookmarkId: null,
        editing: false,
        cursor: null,
      }),
    );
  });

  it("requires confirmation to delete and cancel changes nothing", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<SavedViewList views={[saved]} onOpen={vi.fn()} onEdit={vi.fn()} onDelete={onDelete} />);
    await user.click(screen.getByRole("button", { name: /delete research watch/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /delete research watch/i }));
    await user.click(screen.getByRole("button", { name: /delete saved view/i }));
    expect(onDelete).toHaveBeenCalledWith(saved);
  });
});

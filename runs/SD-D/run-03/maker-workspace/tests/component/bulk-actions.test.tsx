// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BulkActionBar } from "../../src/client/features/selection/BulkActionBar";
import {
  computeClientCriteriaHash,
  SelectionControls,
} from "../../src/client/features/selection/SelectionControls";
import type {
  BookmarkApiClient,
  SearchCriteria,
  Selection,
  SelectionCreate,
} from "../../src/client/lib/api";
import { ApiError } from "../../src/client/lib/api";

const criteria: SearchCriteria = {
  scope: "active",
  query: "#research exact",
  tags: ["Reading"],
  favorite: null,
  unread: null,
  sort: "created_desc",
};

const criteriaHash = "sha256:3ffdf0eb05ad96d2e9e1e74c65471a8ab41b6dd0a9a1c6c158b9530fc367e2dd";

function selection(selectedCount: number, id = "selection-token"): Selection {
  return {
    id,
    selectedCount,
    criteriaHash,
    expiresAt: "2026-09-17T12:30:00.000Z",
  };
}

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
    createSelection: vi
      .fn()
      .mockImplementation(async (input: SelectionCreate) =>
        selection(input.mode === "ids" ? input.ids.length : 8),
      ),
    clearSelection: vi.fn().mockResolvedValue(undefined),
    applyBulkAction: vi.fn().mockResolvedValue({
      selectedCount: 3,
      processedCount: 3,
      changedCount: 2,
    }),
    listSavedViews: vi.fn(),
    createSavedView: vi.fn(),
    updateSavedView: vi.fn(),
    deleteSavedView: vi.fn(),
    ...overrides,
  } as BookmarkApiClient;
}

afterEach(() => vi.restoreAllMocks());

describe("selection controls", () => {
  it("computes the exact browser-safe server criteria identity", () => {
    expect(computeClientCriteriaHash(criteria)).toBe(
      "sha256:3ffdf0eb05ad96d2e9e1e74c65471a8ab41b6dd0a9a1c6c158b9530fc367e2dd",
    );
  });

  it("selects individual bookmarks, shows a visible count, and snapshots exact IDs", async () => {
    const createSelection = vi
      .fn()
      .mockImplementation(async (input: SelectionCreate) =>
        selection(input.mode === "ids" ? input.ids.length : 8),
      );
    const onSelectionChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SelectionControls
        visibleBookmarks={[
          { id: 11, title: "Alpha" },
          { id: 12, title: "Beta" },
        ]}
        totalResults={8}
        criteria={criteria}
        client={client({ createSelection })}
        onSelectionChange={onSelectionChange}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: /select alpha/i }));
    await waitFor(() =>
      expect(createSelection).toHaveBeenCalledWith({
        mode: "ids",
        ids: [11],
        criteriaHash,
      }),
    );
    expect(screen.getByRole("status", { name: /selection count/i })).toHaveTextContent(
      "1 bookmark selected",
    );
    expect(onSelectionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ selectedCount: 1 }),
    );
  });

  it("distinguishes the visible page from all current results and explains off-screen inclusion", async () => {
    const createSelection = vi
      .fn()
      .mockImplementation(async (input: SelectionCreate) =>
        selection(input.mode === "ids" ? input.ids.length : 8),
      );
    const user = userEvent.setup();
    render(
      <SelectionControls
        visibleBookmarks={[
          { id: 11, title: "Alpha" },
          { id: 12, title: "Beta" },
        ]}
        totalResults={8}
        criteria={criteria}
        client={client({ createSelection })}
        onSelectionChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /select 2 on this page/i }));
    await waitFor(() =>
      expect(createSelection).toHaveBeenCalledWith({
        mode: "ids",
        ids: [11, 12],
        criteriaHash,
      }),
    );
    expect(screen.getByRole("status", { name: /selection count/i })).toHaveTextContent(
      "2 bookmarks selected",
    );

    await user.click(screen.getByRole("button", { name: /select all 8 results/i }));
    await waitFor(() =>
      expect(createSelection).toHaveBeenLastCalledWith({
        mode: "all_results",
        criteria,
        criteriaHash,
      }),
    );
    expect(screen.getByText(/includes 6 results not shown on this page/i)).toBeInTheDocument();
  });

  it("clears the server snapshot and local checks when the defining view changes", async () => {
    const clearSelection = vi.fn().mockResolvedValue(undefined);
    const apiClient = client({ clearSelection });
    const onSelectionChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <SelectionControls
        visibleBookmarks={[{ id: 11, title: "Alpha" }]}
        totalResults={1}
        criteria={criteria}
        client={apiClient}
        onSelectionChange={onSelectionChange}
      />,
    );
    await user.click(screen.getByRole("checkbox", { name: /select alpha/i }));
    await screen.findByText(/1 bookmark selected/i);

    rerender(
      <SelectionControls
        visibleBookmarks={[{ id: 21, title: "Gamma" }]}
        totalResults={1}
        criteria={{ ...criteria, query: "changed" }}
        client={apiClient}
        onSelectionChange={onSelectionChange}
      />,
    );

    await waitFor(() => expect(clearSelection).toHaveBeenCalledWith("selection-token"));
    expect(screen.getByRole("status", { name: /selection count/i })).toHaveTextContent(
      "0 bookmarks selected",
    );
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
  });
});

describe("bulk action bar", () => {
  it("offers every state action and reports exact processed and changed counts", async () => {
    const applyBulkAction = vi.fn().mockResolvedValue({
      selectedCount: 3,
      processedCount: 3,
      changedCount: 2,
    });
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(
      <BulkActionBar
        selection={selection(3)}
        client={client({ applyBulkAction })}
        onComplete={onComplete}
        onClear={vi.fn()}
        onExpired={vi.fn()}
      />,
    );

    for (const label of [
      "Favorite",
      "Unfavorite",
      "Mark unread",
      "Mark read",
      "Archive",
      "Restore",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    await user.click(screen.getByRole("button", { name: "Favorite" }));

    await waitFor(() =>
      expect(applyBulkAction).toHaveBeenCalledWith("selection-token", { type: "favorite" }),
    );
    expect(screen.getByRole("status", { name: /bulk action result/i })).toHaveTextContent(
      /processed 3.*changed 2/i,
    );
    expect(onComplete).toHaveBeenCalledWith(
      { selectedCount: 3, processedCount: 3, changedCount: 2 },
      { type: "favorite" },
    );
  });

  it("normalizes tag entry for add and remove actions", async () => {
    const applyBulkAction = vi.fn().mockResolvedValue({
      selectedCount: 3,
      processedCount: 3,
      changedCount: 3,
    });
    const user = userEvent.setup();
    render(
      <BulkActionBar
        selection={selection(3)}
        client={client({ applyBulkAction })}
        onComplete={vi.fn()}
        onClear={vi.fn()}
        onExpired={vi.fn()}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /bulk tags/i }),
      "Research, design, research",
    );
    await user.click(screen.getByRole("button", { name: /add tags/i }));
    await waitFor(() =>
      expect(applyBulkAction).toHaveBeenCalledWith("selection-token", {
        type: "add_tags",
        tags: ["Research", "design"],
      }),
    );
  });

  it("requires count-specific confirmation before permanent deletion and restores focus on cancel", async () => {
    const applyBulkAction = vi.fn().mockResolvedValue({
      selectedCount: 3,
      processedCount: 3,
      changedCount: 3,
    });
    const user = userEvent.setup();
    render(
      <BulkActionBar
        selection={selection(3)}
        client={client({ applyBulkAction })}
        onComplete={vi.fn()}
        onClear={vi.fn()}
        onExpired={vi.fn()}
      />,
    );

    const deleteButton = screen.getByRole("button", { name: /permanently delete/i });
    await user.click(deleteButton);
    const dialog = screen.getByRole("dialog", { name: /delete 3 bookmarks/i });
    expect(within(dialog).getByText(/cannot be undone/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /cancel/i }));
    expect(applyBulkAction).not.toHaveBeenCalled();
    expect(deleteButton).toHaveFocus();

    await user.click(deleteButton);
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /delete 3 bookmarks/i }),
    );
    await waitFor(() =>
      expect(applyBulkAction).toHaveBeenCalledWith("selection-token", { type: "delete" }),
    );
  });

  it("recovers clearly when a snapshot expires", async () => {
    const expired = new ApiError(409, {
      code: "SELECTION_EXPIRED",
      message: "The selection expired. Select the bookmarks again.",
    });
    const onExpired = vi.fn();
    const user = userEvent.setup();
    render(
      <BulkActionBar
        selection={selection(3)}
        client={client({ applyBulkAction: vi.fn().mockRejectedValue(expired) })}
        onComplete={vi.fn()}
        onClear={vi.fn()}
        onExpired={onExpired}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/selection expired.*select.*again/i);
    expect(onExpired).toHaveBeenCalled();
  });
});

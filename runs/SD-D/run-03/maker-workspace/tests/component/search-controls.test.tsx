// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SearchControls } from "../../src/client/features/search/SearchControls";
import { DEFAULT_VIEW_STATE, type ViewState } from "../../src/client/lib/view-state";

const tags = [
  { id: 1, name: "news", activeBookmarkCount: 4 },
  { id: 2, name: "machine learning", activeBookmarkCount: 2 },
];

function view(overrides: Partial<ViewState> = {}): ViewState {
  return { ...DEFAULT_VIEW_STATE, ...overrides, tags: overrides.tags ?? [] };
}

function StatefulControls({
  initial,
  onChange,
}: {
  initial: ViewState;
  onChange: (next: ViewState) => void;
}) {
  const [current, setCurrent] = useState(initial);
  return (
    <SearchControls
      view={current}
      tags={tags}
      total={12}
      onChange={(next) => {
        setCurrent(next);
        onChange(next);
      }}
    />
  );
}

describe("search controls", () => {
  it("explains and validates phrases, exact tags, AND and OR", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StatefulControls initial={view()} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /search syntax help/i }));
    expect(screen.getByText(/#news/)).toBeInTheDocument();
    expect(screen.getByText(/exact phrase/i)).toBeInTheDocument();

    const search = screen.getByRole("searchbox", { name: /search bookmarks/i });
    await user.type(search, '"unfinished');
    expect(screen.getByRole("alert")).toHaveTextContent(/close the quoted phrase/i);
    expect(onChange).not.toHaveBeenCalled();

    await user.clear(search);
    await user.type(search, '"climate news" OR #news');
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ query: '"climate news" OR #news', cursor: null }),
    );
  });

  it("combines multiple tag and status filters and exposes every sort", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StatefulControls initial={view()} onChange={onChange} />);

    await user.click(screen.getByRole("checkbox", { name: /news.*4/i }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ["news"] }));

    await user.click(screen.getByRole("checkbox", { name: /machine learning.*2/i }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ tags: ["news", "machine learning"] }),
    );

    await user.selectOptions(screen.getByRole("combobox", { name: /favorite filter/i }), "true");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ favorite: true }));
    await user.selectOptions(screen.getByRole("combobox", { name: /reading filter/i }), "true");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ unread: true }));

    const sort = screen.getByRole("combobox", { name: /sort bookmarks/i });
    expect(sort).toContainHTML("Newest saved");
    expect(sort).toContainHTML("Oldest saved");
    expect(sort).toContainHTML("Recently modified");
    expect(sort).toContainHTML("Title");
  });

  it("shows result context and clears all criteria without changing scope", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SearchControls
        view={view({ scope: "archived", query: "news", tags: ["news"], favorite: true })}
        tags={tags}
        total={0}
        onChange={onChange}
      />,
    );

    expect(screen.getByText(/no archived bookmarks match/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /clear search and filters/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "archived",
        query: "",
        tags: [],
        favorite: null,
        unread: null,
        cursor: null,
      }),
    );
  });
});

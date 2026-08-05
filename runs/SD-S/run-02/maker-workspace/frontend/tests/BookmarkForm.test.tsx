import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookmarkForm } from "../src/components/BookmarkForm";
import type { Bookmark } from "../src/api/client";

describe("BookmarkForm", () => {
  it("submits url + parsed tags and omits empty optional fields", async () => {
    const onSubmit = vi.fn();
    render(
      <BookmarkForm editing={null} onSubmit={onSubmit} onCancelEdit={() => {}} />,
    );

    await userEvent.type(screen.getByLabelText("Address"), "https://example.com");
    await userEvent.type(screen.getByLabelText("Tags"), "Tech, reading");
    await userEvent.click(screen.getByRole("button", { name: /save bookmark/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      url: "https://example.com",
      title: undefined,
      description: undefined,
      tags: ["Tech", "reading"],
    });
  });

  it("shows a validation error passed from the parent", () => {
    render(
      <BookmarkForm
        editing={null}
        error="not a valid web address"
        onSubmit={() => {}}
        onCancelEdit={() => {}}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("not a valid web address");
  });

  it("prefills fields when editing", () => {
    const bookmark: Bookmark = {
      id: "1",
      url: "https://example.com",
      title: "Existing",
      description: "notes",
      tags: ["a", "b"],
      createdAt: "",
      updatedAt: "",
    };
    render(
      <BookmarkForm editing={bookmark} onSubmit={() => {}} onCancelEdit={() => {}} />,
    );
    expect(screen.getByLabelText("Title")).toHaveValue("Existing");
    expect(screen.getByLabelText("Tags")).toHaveValue("a, b");
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
  });
});

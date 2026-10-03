import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { BookmarkList } from "~/components/bookmark-list";

it("distinguishes a filtered no-match state", () => {
  const { rerender } = render(<BookmarkList bookmarks={[]} />);
  expect(screen.getByText("Your library is ready.")).toBeInTheDocument();
  rerender(<BookmarkList bookmarks={[]} filtered />);
  expect(screen.getByText("No bookmarks match.")).toBeInTheDocument();
});

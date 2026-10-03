import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { BookmarkCard } from "~/components/bookmark-card";

it("renders bookmark tags", () => {
  render(<BookmarkCard bookmark={{ id: "b1", url: "https://example.com", title: "Example", description: null, tags: [{ id: "t1", name: "Reading" }], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }} />);
  expect(screen.getByText("Reading")).toBeInTheDocument();
});

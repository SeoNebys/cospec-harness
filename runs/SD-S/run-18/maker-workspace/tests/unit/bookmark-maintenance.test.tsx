import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { BookmarkCard } from "~/components/bookmark-card";

const bookmark = { id: "b1", url: "https://example.com", title: "Example", description: "Description", tags: [{ id: "t1", name: "Reading" }], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

it("prefills editing and requires explicit delete confirmation", async () => {
  render(<BookmarkCard bookmark={bookmark} />);
  await userEvent.click(screen.getByRole("button", { name: "Edit" }));
  expect(screen.getByLabelText("Edit web address")).toHaveValue(bookmark.url);
  expect(screen.getByLabelText("Edit title")).toHaveValue(bookmark.title);
  expect(screen.getByLabelText("Edit tags")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Keep bookmark" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});

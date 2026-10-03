import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { expect, it } from "vitest";
import { FilterBar } from "~/components/filter-bar";

it("restores active criteria and clears them together", async () => {
  render(<MemoryRouter initialEntries={["/?query=guide&tag=Reading"]}><FilterBar tags={[{ id: "t1", name: "Reading", bookmarkCount: 2 }]} /></MemoryRouter>);
  expect(screen.getByRole("searchbox")).toHaveValue("guide");
  expect(screen.getByRole("combobox")).toHaveValue("Reading");
  await userEvent.click(screen.getByRole("button", { name: "Clear search and filters" }));
  expect(screen.getByRole("searchbox")).toHaveValue("");
});

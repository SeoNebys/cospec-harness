import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { TagInput } from "~/components/tag-input";

describe("TagInput", () => {
  it("adds, reuses case-insensitively, and removes tags", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = useState<string[]>([]);
      return <TagInput value={value} onChange={setValue} suggestions={["Reading"]} />;
    }
    render(<Harness />);
    await user.type(screen.getByLabelText("Tags"), "reading{Enter}");
    expect(screen.getByText("Reading")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Reading" }));
    expect(screen.queryByText("Reading")).not.toBeInTheDocument();
  });
});

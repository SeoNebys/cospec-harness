import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BookmarkEditor } from "~/components/bookmark-editor";

describe("BookmarkEditor", () => {
  it("retrieves metadata without overwriting a user-edited title", async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
    render(<BookmarkEditor onSaved={vi.fn()} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Web address"), "https://example.com");
    await user.click(screen.getByRole("button", { name: "Get page details" }));
    await user.type(screen.getByLabelText("Title"), "My title");
    finish(Response.json({ requestId: expect.anything(), url: "https://example.com/", title: "Fetched", description: "Fetched description", status: "retrieved", warningCode: null, duplicate: null }));
    expect(await screen.findByDisplayValue("My title")).toBeInTheDocument();
  });
});

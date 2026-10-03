import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";

async function waitUntilReady(page: Page): Promise<void> {
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
}

test("edit, format, favorite, archive, reload, and restore preserve organization", async ({
  page,
}) => {
  const token = `organize${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const address = `https://organize-fixture.invalid/${token}/article`;
  const originalTitle = `${token} Original article`;
  const updatedTitle = `${token} Field guide`;
  const updatedDescription =
    "A personally curated description that should survive every state change.";
  const firstTag = `${token} Research`;
  const secondTag = `${token} Reading`;
  const noteHeading = `${token} Reading notes`;
  const noteMarkdown = [
    `# ${noteHeading}`,
    "",
    "A **carefully saved** idea with `inline context`.",
    "",
    "- First takeaway",
    "- Second takeaway",
    "",
    "[Reference](https://example.com/reference)",
  ].join("\n");

  await page.goto("/");
  await waitUntilReady(page);

  const created = await page.request.post("/api/bookmarks", {
    data: { address, title: originalTitle, unread: true },
  });
  expect(created.status()).toBe(201);
  const bookmarkId = ((await created.json()) as { id: number }).id;
  await page.reload();
  await waitUntilReady(page);

  await test.step("edit text, tags, and a formatted note", async () => {
    const card = page.getByRole("article", { name: originalTitle });
    await expect(card).toBeVisible();
    await page.goto(`/?bookmark=${bookmarkId}&edit=true`);
    await waitUntilReady(page);

    const editor = page.getByRole("dialog", { name: `Edit ${originalTitle}` });
    await expect(editor).toBeVisible();
    const title = editor.getByRole("textbox", { name: /^Title\b/ });
    await title.fill(updatedTitle);
    await editor
      .getByRole("textbox", { name: "Description", exact: true })
      .fill(updatedDescription);
    await editor
      .getByRole("textbox", { name: "Tags", exact: true })
      .fill(`${firstTag}, ${secondTag}, ${firstTag.toLocaleUpperCase()}`);
    await editor.getByRole("textbox", { name: "Note source" }).fill(noteMarkdown);

    await editor.getByRole("button", { name: "Preview note" }).click();
    const preview = editor.getByRole("region", { name: "Formatted note preview" });
    await expect(preview.getByRole("heading", { name: noteHeading })).toBeVisible();
    await expect(preview.getByText("carefully saved", { exact: true })).toHaveCSS(
      "font-weight",
      /700|bold/,
    );
    await expect(preview.getByText("inline context", { exact: true })).toBeVisible();
    await expect(preview.getByRole("list")).toBeVisible();
    await expect(preview.getByRole("link", { name: "Reference" })).toHaveAttribute(
      "href",
      "https://example.com/reference",
    );

    await editor.getByRole("button", { name: "Save changes" }).click();
    const updatedDetail = page.getByRole("dialog", { name: updatedTitle });
    await expect(updatedDetail).toBeVisible();
    await expect(updatedDetail.getByText(updatedDescription, { exact: true })).toBeVisible();
    const tags = updatedDetail.getByRole("list", { name: "Tags" });
    await expect(tags.getByText(firstTag, { exact: true })).toBeVisible();
    await expect(tags.getByText(secondTag, { exact: true })).toBeVisible();
    await expect(tags.getByRole("listitem")).toHaveCount(2);

    const note = updatedDetail.getByRole("region", { name: "Notes" });
    await expect(note.getByRole("heading", { name: noteHeading })).toBeVisible();
    await expect(note.getByText("carefully saved", { exact: true })).toBeVisible();
    await expect(note.getByText("inline context", { exact: true })).toBeVisible();
    await expect(note.getByRole("link", { name: "Reference" })).toHaveAttribute("target", "_blank");
  });

  await test.step("favorite and archive without clearing Read Later", async () => {
    const detail = page.getByRole("dialog", { name: updatedTitle });
    await detail.getByRole("button", { name: "Add to favorites" }).click();
    await expect(detail.getByRole("button", { name: "Remove from favorites" })).toBeVisible();
    await expect(detail.getByText("Yes", { exact: true })).toBeVisible();

    await detail.getByRole("button", { name: "Archive bookmark" }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("scope")).toBe("archived");
    await expect(detail.getByRole("button", { name: "Restore bookmark" })).toBeVisible();
    await expect(detail.getByRole("status")).toContainText(/archived.*read later retained/i);
    await expect(detail.getByText("Read Later", { exact: true })).toBeVisible();
    await detail.getByRole("button", { name: "Close", exact: true }).click();

    await waitUntilReady(page);
    const archivedCard = page.getByRole("article", { name: updatedTitle });
    await expect(archivedCard).toBeVisible();
    await expect(archivedCard.getByText("★ Favorite", { exact: true })).toBeVisible();
    await expect(archivedCard.getByText("Read Later", { exact: true })).toBeVisible();
  });

  await test.step("reload archived data and restore it into Read Later", async () => {
    await page.reload();
    await waitUntilReady(page);
    const archivedCard = page.getByRole("article", { name: updatedTitle });
    await expect(archivedCard).toBeVisible();
    await archivedCard.getByRole("button", { name: updatedTitle, exact: true }).click();

    const detail = page.getByRole("dialog", { name: updatedTitle });
    await expect(detail.getByText(updatedDescription, { exact: true })).toBeVisible();
    await expect(detail.getByRole("list", { name: "Tags" }).getByRole("listitem")).toHaveCount(2);
    await expect(detail.getByRole("region", { name: "Notes" })).toContainText(noteHeading);
    await expect(detail.getByText("Yes", { exact: true })).toBeVisible();
    await expect(detail.getByText("Read Later", { exact: true })).toBeVisible();

    await detail.getByRole("button", { name: "Restore bookmark" }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("scope")).toBe("read_later");
    await expect(detail.getByRole("button", { name: "Archive bookmark" })).toBeVisible();
    await expect(detail.getByRole("status")).toContainText(/restored.*read later retained/i);
    await detail.getByRole("button", { name: "Close", exact: true }).click();

    await waitUntilReady(page);
    const readLaterCard = page.getByRole("article", { name: updatedTitle });
    await expect(readLaterCard).toBeVisible();
    await expect(readLaterCard.getByText("★ Favorite", { exact: true })).toBeVisible();
    await expect(readLaterCard.getByText("Read Later", { exact: true })).toBeVisible();
  });
});

import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";

interface BookmarkRecord {
  id: number;
  address: string;
  title: string;
  description: string;
  noteMarkdown: string;
  tags: Array<{ id: number; name: string }>;
}

async function waitUntilReady(page: Page): Promise<void> {
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
}

async function getBookmark(page: Page, bookmarkId: number) {
  return page.request.get(`/api/bookmarks/${bookmarkId}`);
}

test("editing is failure-safe and permanent deletion removes every live result", async ({
  page,
}) => {
  const token = `editdelete${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const sourceAddress = `https://edit-delete.invalid/${token}/source`;
  const updatedAddress = `https://edit-delete.invalid/${token}/updated?edition=2#notes`;
  const duplicateAddress = `https://edit-delete.invalid/${token}/existing`;
  const originalTitle = `${token} Original source`;
  const updatedTitle = `${token} Carefully edited`;
  const duplicateTitle = `${token} Existing destination`;
  const updatedDescription = "Every editable field should survive a browser reload.";
  const updatedNote = `# ${token} Notes\n\nA **durable** edit with \`context\`.`;
  const firstTag = `${token} Research`;
  const secondTag = `${token} Reference`;

  const sourceResponse = await page.request.post("/api/bookmarks", {
    data: {
      address: sourceAddress,
      title: originalTitle,
      description: "Before editing",
      unread: true,
      favorite: true,
    },
  });
  expect(sourceResponse.status(), await sourceResponse.text()).toBe(201);
  const sourceId = ((await sourceResponse.json()) as BookmarkRecord).id;

  const duplicateResponse = await page.request.post("/api/bookmarks", {
    data: { address: duplicateAddress, title: duplicateTitle },
  });
  expect(duplicateResponse.status(), await duplicateResponse.text()).toBe(201);
  const duplicateId = ((await duplicateResponse.json()) as BookmarkRecord).id;

  await page.goto(`/?bookmark=${sourceId}&edit=true`);
  await waitUntilReady(page);

  await test.step("edit every field and retain the saved result after reload", async () => {
    const editor = page.getByRole("dialog", { name: `Edit ${originalTitle}` });
    await expect(editor).toBeVisible();
    await editor.getByRole("textbox", { name: "Web address" }).fill(updatedAddress);
    await editor.getByRole("textbox", { name: /^Title\b/ }).fill(updatedTitle);
    await editor
      .getByRole("textbox", { name: "Description", exact: true })
      .fill(updatedDescription);
    await editor
      .getByRole("textbox", { name: "Tags", exact: true })
      .fill(`${firstTag}, ${secondTag}, ${firstTag.toLocaleUpperCase()}`);
    await editor.getByRole("textbox", { name: "Note source" }).fill(updatedNote);
    await editor.getByRole("button", { name: "Save changes" }).click();

    const detail = page.getByRole("dialog", { name: updatedTitle });
    await expect(detail).toBeVisible();
    await expect(detail.getByText(updatedAddress, { exact: true })).toBeVisible();
    await expect(detail.getByText(updatedDescription, { exact: true })).toBeVisible();
    await expect(detail.getByRole("list", { name: "Tags" }).getByRole("listitem")).toHaveCount(2);
    await expect(detail.getByRole("region", { name: "Notes" })).toContainText(`${token} Notes`);

    await page.reload();
    await waitUntilReady(page);
    const reloaded = page.getByRole("dialog", { name: updatedTitle });
    await expect(reloaded).toBeVisible();
    await expect(reloaded.getByText(updatedAddress, { exact: true })).toBeVisible();
    await expect(reloaded.getByText(updatedDescription, { exact: true })).toBeVisible();
    await expect(reloaded.getByRole("list", { name: "Tags" }).getByRole("listitem")).toHaveCount(2);
    await expect(reloaded.getByRole("region", { name: "Notes" })).toContainText("durable");
  });

  await test.step("reject an invalid address while preserving the complete draft and stored row", async () => {
    const detail = page.getByRole("dialog", { name: updatedTitle });
    await detail.getByRole("button", { name: "Edit bookmark" }).click();
    const editor = page.getByRole("dialog", { name: `Edit ${updatedTitle}` });
    const address = editor.getByRole("textbox", { name: "Web address" });
    const title = editor.getByRole("textbox", { name: /^Title\b/ });
    await address.fill(`ftp://edit-delete.invalid/${token}/invalid-draft`);
    await title.fill(`${token} Unsaved invalid draft`);
    await editor.getByRole("button", { name: "Save changes" }).click();

    await expect(editor.getByRole("alert")).toContainText(/http|https|address/i);
    await expect(address).toHaveValue(`ftp://edit-delete.invalid/${token}/invalid-draft`);
    await expect(title).toHaveValue(`${token} Unsaved invalid draft`);

    const storedResponse = await getBookmark(page, sourceId);
    expect(storedResponse.status(), await storedResponse.text()).toBe(200);
    const stored = (await storedResponse.json()) as BookmarkRecord;
    expect(stored.address).toBe(updatedAddress);
    expect(stored.title).toBe(updatedTitle);
    expect(stored.description).toBe(updatedDescription);
  });

  await test.step("route a duplicate address to the existing editor without changing the source", async () => {
    const sourceEditor = page.getByRole("dialog", { name: `Edit ${updatedTitle}` });
    await sourceEditor
      .getByRole("textbox", { name: "Web address" })
      .fill(`HTTPS://EDIT-DELETE.INVALID:443/${token}/existing`);
    await sourceEditor.getByRole("textbox", { name: /^Title\b/ }).fill(`${token} Must not apply`);
    await sourceEditor.getByRole("button", { name: "Save changes" }).click();

    await expect
      .poll(() => new URL(page.url()).searchParams.get("bookmark"))
      .toBe(String(duplicateId));
    await expect.poll(() => new URL(page.url()).searchParams.get("edit")).toBe("true");
    await expect(page.getByRole("dialog", { name: `Edit ${duplicateTitle}` })).toBeVisible();

    const storedResponse = await getBookmark(page, sourceId);
    expect(storedResponse.status(), await storedResponse.text()).toBe(200);
    const stored = (await storedResponse.json()) as BookmarkRecord;
    expect(stored.address).toBe(updatedAddress);
    expect(stored.title).toBe(updatedTitle);
  });

  await test.step("cancel permanent deletion without changing the bookmark", async () => {
    await page.goto(`/?bookmark=${sourceId}&edit=true`);
    await waitUntilReady(page);
    const editor = page.getByRole("dialog", { name: `Edit ${updatedTitle}` });
    await editor.getByRole("button", { name: "Delete bookmark" }).click();

    const confirmation = page.getByRole("dialog", {
      name: `Permanently delete ${updatedTitle}?`,
    });
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByText(/cannot be undone/i)).toBeVisible();
    await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();

    await expect(confirmation).toHaveCount(0);
    await expect(editor).toBeVisible();
    const storedResponse = await getBookmark(page, sourceId);
    expect(storedResponse.status(), await storedResponse.text()).toBe(200);
  });

  await test.step("confirm deletion and remove the bookmark from every scope and live search", async () => {
    const editor = page.getByRole("dialog", { name: `Edit ${updatedTitle}` });
    await editor.getByRole("button", { name: "Delete bookmark" }).click();
    const confirmation = page.getByRole("dialog", {
      name: `Permanently delete ${updatedTitle}?`,
    });
    await confirmation.getByRole("button", { name: "Delete bookmark", exact: true }).click();

    const announcement = page.getByRole("status", { name: "Reading list update" });
    await expect(announcement).toContainText(/permanently deleted/i);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const missingResponse = await getBookmark(page, sourceId);
    expect(missingResponse.status()).toBe(404);

    const search = page.getByRole("searchbox", { name: "Search bookmarks" });
    await search.fill(token);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("article", { name: updatedTitle })).toHaveCount(0);

    await page.getByRole("link", { name: /read later/i }).click();
    await waitUntilReady(page);
    await expect(page.getByRole("article", { name: updatedTitle })).toHaveCount(0);

    await page.getByRole("link", { name: "Archive", exact: true }).click();
    await waitUntilReady(page);
    await expect(page.getByRole("article", { name: updatedTitle })).toHaveCount(0);
    await expect(page.getByRole("article", { name: duplicateTitle })).toHaveCount(0);
  });
});

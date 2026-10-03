import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

async function waitUntilReady(page: Page): Promise<void> {
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
}

async function searchFor(page: Page, query: string): Promise<void> {
  await page.getByRole("searchbox", { name: "Search bookmarks" }).fill(query);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(query);
}

test("Read Later stays independent from favorites and removes an item when read", async ({
  page,
}) => {
  const token = `later${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const title = `${token} Target article`;
  const address = `https://read-later-fixture.invalid/${token}/target`;
  const companionTitle = `${token} Companion article`;

  await page.goto("/");
  await waitUntilReady(page);

  await test.step("capture a favorite directly into Read Later", async () => {
    await page.getByRole("button", { name: "Add bookmark" }).click();
    const capture = page.getByRole("dialog", { name: "Save a bookmark" });
    await capture.getByRole("textbox", { name: "Web address" }).fill(address);
    await capture.getByRole("textbox", { name: "Title (optional)" }).fill(title);
    await capture.getByRole("checkbox", { name: "Read Later" }).check();
    await capture.getByRole("checkbox", { name: "Favorite" }).check();
    await capture.getByRole("button", { name: "Save bookmark" }).click();

    const detail = page.getByRole("dialog", { name: title });
    await expect(detail).toBeVisible();
    await expect(detail.getByText("Read Later", { exact: true })).toBeVisible();
    await expect(detail.getByText("Yes", { exact: true })).toBeVisible();
    await detail.getByRole("button", { name: "Close", exact: true }).click();
  });

  await test.step("keep a non-favorite unread bookmark in the same queue", async () => {
    const response = await page.request.post("/api/bookmarks", {
      data: {
        address: `https://read-later-fixture.invalid/${token}/companion`,
        title: companionTitle,
        favorite: false,
        unread: true,
      },
    });
    expect(response.status(), await response.text()).toBe(201);
  });

  await test.step("search inside the dedicated Read Later scope", async () => {
    await page.getByRole("link", { name: /read later/i }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("scope")).toBe("read_later");
    await waitUntilReady(page);

    await searchFor(page, `${token} target`);
    await expect(page.getByRole("article", { name: title })).toBeVisible();
    await expect(page.getByRole("article", { name: companionTitle })).toHaveCount(0);
  });

  await test.step("mark the result read and remove it from Read Later", async () => {
    const card = page.getByRole("article", { name: title });
    await card.getByRole("button", { name: `Mark ${title} as read` }).click();

    await expect(page.getByRole("article", { name: title })).toHaveCount(0);
    const feedback = page.getByRole("status", { name: /reading list update/i });
    await expect(feedback).toContainText(/marked.*read/i);
  });

  await test.step("retain the bookmark and favorite state in the active collection", async () => {
    await page.getByRole("link", { name: "Bookmarks", exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("scope")).toBeNull();
    await waitUntilReady(page);

    const card = page.getByRole("article", { name: title });
    await expect(card).toBeVisible();
    await expect(card.getByText(/favorite/i)).toBeVisible();
    await expect(card.getByRole("button", { name: `Add ${title} to Read Later` })).toBeVisible();
  });
});

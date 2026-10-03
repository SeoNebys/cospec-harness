import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("review@example.com");
  await page.getByLabel("Password").fill("Review-password-2026!");
  await page.getByRole("button", { name: "Welcome back" }).click();
  await expect(page).toHaveURL(/\/bookmarks/);
}

test("review account can use the seeded collection and save a URL-only bookmark", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Bookmarks", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Accessibility on the web" })).toBeVisible();
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  const accessibility = await new AxeBuilder({ page: page as never }).analyze();
  expect(accessibility.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  const uniqueUrl = `https://example.com/?smoke=${Date.now()}`;
  await page.getByRole("button", { name: "+ Save a link" }).first().click();
  await page.getByLabel("Web address").fill(uniqueUrl);
  await page.getByRole("button", { name: "Fetch page details" }).click();
  await expect(page.getByLabel("Title")).toBeVisible({ timeout: 10_000 });
  const title = await page.getByLabel("Title").inputValue();
  expect(title.length).toBeGreaterThan(0);
  const editedTitle = `Saved from the browser ${Date.now()}`;
  await page.getByLabel("Title").fill(editedTitle);
  await page.getByLabel("Page description").fill("A description I can change before saving.");
  await page.getByRole("textbox", { name: "Tags", exact: true }).fill("browser-test, reference");
  await page.getByPlaceholder(/Add your thoughts/).fill("## My note\n\nRemember the **exact phrase kiwi telescope**.");
  await page.getByLabel("Add to read later").check();
  await page.getByRole("button", { name: "Save bookmark" }).click();
  const savedLink = page.locator(`a[href="${uniqueUrl}"]`, { hasText: editedTitle });
  await expect(savedLink).toBeVisible();

  await page.getByLabel("Search bookmarks").fill('"kiwi telescope" AND tag:browser-test');
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(savedLink).toBeVisible();
  await page.getByRole("link", { name: "Clear" }).click();

  await page.getByRole("link", { name: /Unread/ }).click();
  await expect(savedLink).toBeVisible();
  await savedLink.locator("xpath=ancestor::article").getByRole("button", { name: "Mark read" }).click();
  await expect(savedLink).not.toBeVisible();

  await page.getByRole("link", { name: /^Bookmarks/ }).click();
  await expect(savedLink).toBeVisible();
  await savedLink.locator("xpath=ancestor::article").getByRole("button", { name: "Archive" }).click();
  await expect(savedLink).not.toBeVisible();
  await page.getByRole("link", { name: /Archive/ }).click();
  await expect(savedLink).toBeVisible();
  await savedLink.locator("xpath=ancestor::article").getByRole("button", { name: "Restore" }).click();
  await expect(savedLink).not.toBeVisible();

  await page.getByRole("link", { name: /^Bookmarks/ }).click();
  await page.getByRole("button", { name: "+ Save a link" }).first().click();
  await page.getByLabel("Web address").fill(uniqueUrl);
  await page.getByRole("button", { name: "Fetch page details" }).click();
  await expect(page).toHaveURL(/\/bookmarks\?focus=/);

  await expect(savedLink).toBeVisible();

  const unavailableUrl = `https://unavailable-${Date.now()}.invalid/article`;
  await page.getByRole("button", { name: "+ Save a link" }).first().click();
  await page.getByLabel("Web address").fill(unavailableUrl);
  await page.getByRole("button", { name: "Fetch page details" }).click();
  await expect(page.getByText(/still save/i)).toBeVisible({ timeout: 10_000 });
  const fallbackTitle = await page.getByLabel("Title").inputValue();
  await page.getByRole("button", { name: "Save bookmark" }).click();
  const fallbackLink = page.locator(`a[href="${unavailableUrl}"]`, { hasText: fallbackTitle });
  await expect(fallbackLink).toBeVisible();
  await fallbackLink.locator("xpath=ancestor::article").getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete 1 permanently" }).click();
  await expect(fallbackLink).not.toBeVisible();

  await savedLink.locator("xpath=ancestor::article").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("heading", { name: "Delete 1 bookmark?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(savedLink).toBeVisible();
  await savedLink.locator("xpath=ancestor::article").getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete 1 permanently" }).click();
  await expect(savedLink).not.toBeVisible();
});

import { randomUUID } from "node:crypto";
import { expect, type Page, type Route, test } from "@playwright/test";

interface MetadataPreviewRequest {
  address?: string;
}

const retrievedTitle = "A deterministic page title";
const retrievedDescription = "A deterministic description supplied by the browser fixture.";

async function installMetadataFixture(page: Page, enrichedAddress: string) {
  await page.route("**/api/metadata/preview", async (route: Route) => {
    const request = route.request();
    const body = request.postDataJSON() as MetadataPreviewRequest | null;

    // Let the real API handle every address except the one explicitly owned by
    // this fixture. In particular, duplicate preview requests must reach the
    // database so the journey proves the server-side uniqueness behavior.
    if (body?.address !== enrichedAddress) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        address: enrichedAddress,
        status: "complete",
        fallbackTitle: "Enriched article — bookmark-fixture.invalid",
        title: retrievedTitle,
        description: retrievedDescription,
        iconAvailable: false,
        errorCode: null,
      }),
    });
  });
}

async function openCapture(page: Page) {
  await page.getByRole("button", { name: "Add bookmark" }).click();
  const dialog = page.getByRole("dialog", { name: "Save a bookmark" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("address-only capture remains useful, durable, editable, and duplicate-free", async ({
  page,
}) => {
  const runId = randomUUID().replaceAll("-", "");
  const fallbackAddress = `https://bookmark-fixture.invalid/reading/slow-page-${runId}`;
  const equivalentFallbackAddress = `HTTPS://BOOKMARK-FIXTURE.INVALID:443/reading/slow-page-${runId}`;
  const fallbackTitle = `Slow page ${runId} — bookmark-fixture.invalid`;
  const enrichedAddress = `https://bookmark-fixture.invalid/reading/enriched-${runId}`;
  const customTitle = `My saved title ${runId}`;
  const customDescription = "My own description must survive later metadata work.";

  await installMetadataFixture(page, enrichedAddress);
  await page.goto("/");
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();

  await test.step("save immediately from only an address and use clear fallbacks", async () => {
    const capture = await openCapture(page);
    await capture.getByRole("textbox", { name: "Web address" }).fill(fallbackAddress);

    // Submit before the debounced preview begins. Saving must never wait for
    // metadata, DNS, or a destination that cannot be reached.
    await capture.getByRole("button", { name: "Save bookmark" }).click();

    const card = page.getByRole("article", { name: fallbackTitle });
    await expect(card).toBeVisible();
    await expect(card.getByLabel(`No site icon for ${fallbackTitle}`)).toBeVisible();
    const externalLink = card.getByRole("link", {
      name: `Open destination for ${fallbackTitle}`,
    });
    await expect(externalLink).toHaveAttribute("href", fallbackAddress);
    await expect(externalLink).toHaveAttribute("target", "_blank");
    await expect(externalLink).toHaveAttribute("rel", /\bnoopener\b/);
    await expect(externalLink).toHaveAttribute("rel", /\bnoreferrer\b/);
  });

  await test.step("retain the address-only bookmark after a later page load", async () => {
    await page.goto("/");
    await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
    const card = page.getByRole("article", { name: fallbackTitle });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: fallbackTitle, exact: true }).click();

    const detail = page.getByRole("dialog", { name: fallbackTitle });
    await expect(detail).toBeVisible();
    await expect(detail.getByText(fallbackAddress, { exact: true })).toBeVisible();
    await expect(detail.getByText("No description has been added.")).toBeVisible();
    await detail.getByRole("button", { name: "Close", exact: true }).click();
  });

  await test.step("show deterministic retrieved text and preserve a manual override", async () => {
    const capture = await openCapture(page);
    await capture.getByRole("textbox", { name: "Web address" }).fill(enrichedAddress);
    await expect(capture.getByText("Page details found")).toBeVisible();

    const title = capture.getByRole("textbox", { name: "Title (optional)" });
    const description = capture.getByRole("textbox", { name: "Description (optional)" });
    await expect(title).toHaveValue(retrievedTitle);
    await expect(description).toHaveValue(retrievedDescription);

    await title.fill(customTitle);
    await description.fill(customDescription);
    await capture.getByRole("button", { name: "Save bookmark" }).click();

    const detail = page.getByRole("dialog", { name: customTitle });
    await expect(detail).toBeVisible();
    await expect(detail.getByText(customDescription, { exact: true })).toBeVisible();
    await detail.getByRole("button", { name: "Close", exact: true }).click();

    await page.reload();
    await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
    const card = page.getByRole("article", { name: customTitle });
    await expect(card).toBeVisible();
    await expect(card.getByText(customDescription, { exact: true })).toBeVisible();
  });

  await test.step("route an equivalent duplicate to the existing editor", async () => {
    const capture = await openCapture(page);
    await capture.getByRole("textbox", { name: "Web address" }).fill(equivalentFallbackAddress);

    await expect(page).toHaveURL(/(?:\?|&)bookmark=\d+/);
    await expect(page).toHaveURL(/(?:\?|&)edit=true(?:&|$)/);
    const editor = page.getByRole("dialog", { name: `Edit ${fallbackTitle}` });
    await expect(editor).toBeVisible();
    await expect(editor.getByRole("textbox", { name: /web address/i })).toHaveValue(
      fallbackAddress,
    );

    // The collection still contains only one card for the normalized address.
    await editor.getByRole("button", { name: "Cancel", exact: true }).click();
    const detail = page.getByRole("dialog", { name: fallbackTitle, exact: true });
    await detail.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByRole("article", { name: fallbackTitle })).toHaveCount(1);
  });
});

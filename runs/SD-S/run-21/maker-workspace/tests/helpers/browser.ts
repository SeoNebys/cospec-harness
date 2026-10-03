import type { Page } from "@playwright/test";
export async function waitUntilReady(page: Page) {
  await page.locator('[data-harness-ready="true"]').waitFor();
}

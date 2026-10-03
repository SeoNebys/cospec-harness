import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

export async function scanPage(page: Page) {
  // axe currently resolves Playwright's nested Page type; both refer to the same runtime object.
  return new AxeBuilder({ page: page as never }).exclude("nextjs-portal").analyze();
}

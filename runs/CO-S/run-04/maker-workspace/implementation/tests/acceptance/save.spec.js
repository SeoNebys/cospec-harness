import { test, expect } from "@playwright/test";
import { routeMetadata, saveLink } from "./helpers.mjs";

// SCN-001: save a link and have its page details filled in automatically.
test("saving a link auto-fills its page details", async ({ page }) => {
  await routeMetadata(page, {
    "martinfowler.com/x": {
      error: false,
      title: "The Practical Test Pyramid",
      description: "How to structure automated tests.",
      image: "https://martinfowler.com/img.png",
      favicon: "https://martinfowler.com/favicon.ico",
      host: "martinfowler.com",
    },
  });
  await page.goto("/");
  await saveLink(page, "https://martinfowler.com/x");

  const card = page.locator(".card").first();
  await expect(card.locator(".title")).toHaveText("The Practical Test Pyramid");
  await expect(card.locator(".desc")).toHaveText("How to structure automated tests.");
  await expect(card.locator(".host")).toContainText("martinfowler.com");
  await expect(card.locator(".title a")).toHaveAttribute("href", "https://martinfowler.com/x");
});

// SCN-001: newest saved appears first.
test("newest saved link appears at the top", async ({ page }) => {
  await routeMetadata(page, {
    "one.com": { error: false, title: "One", description: "", image: "", favicon: "", host: "one.com" },
    "two.com": { error: false, title: "Two", description: "", image: "", favicon: "", host: "two.com" },
  });
  await page.goto("/");
  await saveLink(page, "https://one.com");
  await saveLink(page, "https://two.com");
  await expect(page.locator(".card .title").first()).toHaveText("Two");
});

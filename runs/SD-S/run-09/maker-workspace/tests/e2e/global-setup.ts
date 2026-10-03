import fs from "node:fs";
import { chromium, type FullConfig } from "@playwright/test";

export default async function globalSetup(config: FullConfig) {
  fs.mkdirSync("tests/.auth", { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(config.projects[0]!.use.baseURL!);
  await page.getByLabel("Email").fill("review@example.test");
  await page.getByLabel("Password").fill("bookmark-review-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("heading", { name: "Save something worth keeping" }).waitFor();
  await page.context().storageState({ path: "tests/.auth/review.json" });
  await browser.close();
}

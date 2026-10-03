import { test,expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("save, find, edit, cancel deletion, and confirm deletion",async({page})=>{
 const stamp=Date.now(); const url=`https://example.com/${stamp}`, title=`Kept ${stamp}`, edited=`Edited ${stamp}`;
 await page.goto("/"); await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
 await page.getByLabel("Web address").fill(url); await page.getByLabel("Title").fill(title); await page.getByLabel(/Short description/).fill(`Worth remembering ${stamp}`); await page.getByLabel(/Tags/).fill(`reference-${stamp}, calm`); await page.getByRole("button",{name:"Save bookmark"}).click();
 await expect(page.getByRole("link",{name:title})).toBeVisible();
 await page.getByLabel("Search bookmarks").fill(String(stamp)); await expect(page.getByRole("link",{name:title})).toBeVisible();
 await page.getByLabel("Search bookmarks").fill(""); await page.locator(".filter-row").getByRole("button",{name:new RegExp(`#reference-${stamp}`)}).click(); await expect(page.getByRole("link",{name:title})).toBeVisible();
 await page.getByRole("button",{name:`Edit ${title}`}).click(); await page.getByLabel("Title").fill(edited); await page.getByRole("button",{name:"Save changes"}).click(); await expect(page.getByRole("link",{name:edited})).toBeVisible();
 await page.getByRole("button",{name:`Delete ${edited}`}).click(); await page.getByRole("button",{name:"Keep it"}).click(); await expect(page.getByRole("link",{name:edited})).toBeVisible();
 await page.getByRole("button",{name:`Delete ${edited}`}).click(); await page.getByRole("button",{name:"Remove bookmark"}).click(); await expect(page.getByRole("link",{name:edited})).toHaveCount(0);
});

test("initial page has no automatically detectable WCAG A/AA issues",async({page})=>{await page.goto("/");await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();const scan=await new AxeBuilder({page:page as never}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze();expect(scan.violations).toEqual([]);});

test("metadata autofill never overwrites a user edit or a newer URL",async({page})=>{
 await page.route("**/api/metadata",async route=>{const body=route.request().postDataJSON() as {url:string};await new Promise(r=>setTimeout(r,body.url.includes("first")?500:50));await route.fulfill({contentType:"application/json",body:JSON.stringify({status:"complete",title:body.url.includes("first")?"Old title":"Fresh title",description:"Fetched description"})});});
 await page.goto("/"); await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
 await page.getByLabel("Web address").fill("https://example.com/first"); await page.waitForTimeout(480); await page.getByLabel("Title").fill("My own title");
 await expect(page.getByLabel(/Short description/)).toHaveValue("Fetched description"); await expect(page.getByLabel("Title")).toHaveValue("My own title");
 await page.getByLabel("Web address").fill("https://example.com/second"); await expect(page.getByLabel("Title")).toHaveValue("Fresh title",{timeout:1500});
});

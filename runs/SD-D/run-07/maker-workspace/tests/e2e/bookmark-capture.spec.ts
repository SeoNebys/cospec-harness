import { expect,test } from "@playwright/test";
let createdStamp = "";

test("captures a bookmark, preserves a note, and places it in read later",async({page})=>{
  const stamp=Date.now();
  createdStamp=String(stamp);
  await page.goto("/bookmarks/new");
  await page.getByRole("textbox",{name:"Web address"}).fill(`https://example.org/?capture=${stamp}`);
  const title=page.getByRole("textbox",{name:"Title",exact:true});
  await expect(title).not.toHaveValue("",{timeout:10000}).catch(async()=>title.fill(`Capture ${stamp}`));
  await page.getByRole("textbox",{name:"Your note"}).fill(`private context ${stamp}`);
  await page.getByRole("textbox",{name:"Tags"}).fill("research, e2e");
  await page.getByLabel("Read later").check();
  await page.getByRole("button",{name:"Save bookmark"}).click();
  await expect(page).toHaveURL(/\/bookmarks\//);
  await expect(page.getByText(`private context ${stamp}`)).toBeVisible();
  await page.goto(`/unread?q=${stamp}`);
  await expect(page.locator("article.card")).toHaveCount(1);
});

test("supports precise search errors and bulk selection",async({page})=>{
  await page.goto(`/?q=${encodeURIComponent(`tag:research AND "private context ${createdStamp}"`)}`);
  await expect(page.getByText(/Showing:/)).toBeVisible();
  await expect(page.locator("article.card")).toHaveCount(1);
  await page.waitForTimeout(300);
  await page.getByRole("button",{name:/Select all/}).click();
  await expect(page.getByText("1 selected")).toBeVisible();
  await page.goto('/?q=%22unfinished');
  await expect(page.getByText(/Close the quoted phrase/)).toBeVisible();
});

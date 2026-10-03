import { expect,test } from '@playwright/test';

test('a bookmark moves into and out of To Read without leaving the active collection',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium','The same transition is covered on phone and 320px by bookmark-manager.spec.ts.');
  const stamp=Date.now();const title=`Read later ${stamp}`;
  await page.goto('/bookmarks/new');await page.getByLabel('Web address').fill(`https://example.com/us3-${stamp}`);await page.getByLabel('Title').fill(title);await expect(page.getByLabel('To read')).not.toBeChecked();await page.getByLabel('To read').check();await page.getByRole('button',{name:'Save bookmark'}).click();
  await page.getByRole('link',{name:'To Read'}).click();const card=page.getByRole('article').filter({hasText:title});await expect(card).toBeVisible();await card.getByRole('button',{name:'Mark read'}).click();await expect(card).toHaveCount(0);
  await page.getByRole('link',{name:'Bookmarks',exact:true}).click();await page.getByRole('link',{name:title,exact:true}).click();await page.locator('.detail-actions').getByRole('button',{name:'To read'}).click();await page.getByRole('link',{name:'To Read'}).click();await expect(page.getByRole('article').filter({hasText:title})).toBeVisible();
});

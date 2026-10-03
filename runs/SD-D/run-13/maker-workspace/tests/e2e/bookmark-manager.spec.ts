import { expect,test } from '@playwright/test';

test('save, find, read, archive, restore, and delete a bookmark',async({page},testInfo)=>{
  const slug=`pw-${testInfo.project.name}-${Date.now()}`;const url=`https://example.com/${slug}`;const title=`Playwright ${testInfo.project.name}`;
  await page.goto('/bookmarks/new');
  await page.getByLabel('Web address').fill(url);
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Description').fill('A browser-tested bookmark');
  const tagInput=page.getByRole('combobox',{name:/Tags/iu});await tagInput.fill('Browser test');await tagInput.press('Enter');
  await page.getByLabel('To read').check();
  await page.getByRole('button',{name:'Save bookmark'}).press('Enter');
  await expect(page).toHaveURL(/\/bookmarks\/[0-9a-f-]+$/u);
  await expect(page.getByRole('heading',{level:1,name:title})).toBeVisible();

  await page.getByRole('link',{name:'To Read'}).click();
  await expect(page.getByRole('heading',{level:2,name:title})).toBeVisible();
  await page.getByRole('article').filter({hasText:title}).getByRole('button',{name:'Mark read'}).click();
  await expect(page.getByRole('heading',{level:2,name:title})).toHaveCount(0);

  await page.getByRole('link',{name:'Bookmarks',exact:true}).click();
  await page.getByRole('link',{name:title,exact:true}).click();
  await expect(page.getByRole('heading',{level:1,name:title})).toBeVisible();
  await page.locator('.detail-actions').getByRole('button',{name:'Archive'}).click();
  await expect(page).toHaveURL('/archive');
  await expect(page.getByRole('heading',{level:2,name:title})).toBeVisible();
  await page.getByRole('article').filter({hasText:title}).getByRole('button',{name:'Restore'}).click();
  await expect(page.getByRole('heading',{level:2,name:title})).toHaveCount(0);

  await page.getByRole('link',{name:'Bookmarks',exact:true}).click();
  await page.getByRole('link',{name:title,exact:true}).click();
  await expect(page.getByRole('heading',{level:1,name:title})).toBeVisible();
  await page.getByRole('button',{name:'Delete permanently'}).click();
  await expect(page.getByRole('alertdialog')).toContainText(title);
  await page.getByRole('button',{name:'Cancel'}).click();
  await expect(page.getByRole('heading',{level:1,name:title})).toBeVisible();
  await page.getByRole('button',{name:'Delete permanently'}).click();
  await page.getByRole('alertdialog').getByRole('button',{name:'Delete permanently'}).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByText(title)).toHaveCount(0);
});

test('duplicate paste navigates to the existing bookmark',async({page},testInfo)=>{
  const slug=`duplicate-${testInfo.project.name}-${Date.now()}`;const title=`Only one ${testInfo.project.name}`;
  await page.goto('/bookmarks/new');await page.getByLabel('Web address').fill(`https://EXAMPLE.com:443/${slug}`);await page.getByLabel('Title').fill(title);await page.getByRole('button',{name:'Save bookmark'}).press('Enter');await expect(page.getByRole('heading',{level:1,name:title})).toBeVisible();
  const detailUrl=page.url();await page.goto('/bookmarks/new');await page.getByLabel('Web address').fill(`https://example.com/${slug}`);await expect(page).toHaveURL(detailUrl,{timeout:5_000});await expect(page.locator('.status-region')).toContainText('Already saved');
});

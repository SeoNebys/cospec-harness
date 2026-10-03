import { expect,test } from '@playwright/test';

test('paste-to-save remains editable and equivalent active or archived URLs open the existing bookmark',async({page,request},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium','The same save and duplicate flow is covered on phone and 320px by bookmark-manager.spec.ts.');
  const slug=`us1-${Date.now()}`;const url=`https://example.com/${slug}`;const title=`Manual ${slug}`;
  await page.goto('/bookmarks/new');await page.getByLabel('Web address').fill(url);await page.getByLabel('Title').fill(title);await page.getByLabel('Description').fill('My description wins');await page.getByRole('button',{name:'Save bookmark'}).click();
  await expect(page.getByRole('heading',{level:1,name:title})).toBeVisible();const detail=page.url();
  await page.goto('/bookmarks/new');await page.getByLabel('Web address').fill(`https://EXAMPLE.com:443/${slug}`);await expect(page).toHaveURL(detail);await expect(page.locator('.status-region')).toContainText('Already saved');
  const id=detail.split('/').at(-1)!;expect((await request.post(`/api/bookmarks/${id}/archive`)).ok()).toBe(true);
  await page.goto('/bookmarks/new');await page.getByLabel('Web address').fill(url);await expect(page).toHaveURL(detail);await expect(page.locator('.status-region')).toContainText('Archive');await expect(page.getByRole('button',{name:'Restore'})).toBeVisible();
  const list=await request.get('/api/bookmarks?view=archive');expect((await list.json()).items.filter((item:{url:string})=>item.url===url)).toHaveLength(1);
});

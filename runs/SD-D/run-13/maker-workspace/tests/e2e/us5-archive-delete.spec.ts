import { expect,test } from '@playwright/test';

const emptyNote={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Preserved note',marks:[{type:'italic'}]}]}]};
test('archive, archived duplicate navigation, restore, cancel, and permanent delete preserve the promised states',async({page,request},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium','The core lifecycle is covered on phone and 320px by bookmark-manager.spec.ts.');
  const stamp=Date.now();const title=`Archive journey ${stamp}`;const url=`https://example.com/us5-${stamp}`;const created=await request.post('/api/bookmarks',{data:{url,title,description:'Keep me',notes:emptyNote,tags:[`Keep ${stamp}`],favorite:true,toRead:true}});const bookmark=await created.json();
  await page.goto(`/bookmarks/${bookmark.id}`);await page.locator('.detail-actions').getByRole('button',{name:'Archive'}).click();await expect(page).toHaveURL('/archive');const archivedCard=page.getByRole('article').filter({hasText:title});await expect(archivedCard).toBeVisible();
  await page.goto('/bookmarks/new');await page.getByLabel('Web address').fill(url);await expect(page).toHaveURL(`/bookmarks/${bookmark.id}`);await expect(page.getByRole('button',{name:'Restore'})).toBeVisible();await page.getByRole('button',{name:'Restore'}).click();
  await page.getByRole('link',{name:'Bookmarks',exact:true}).click();await page.getByRole('link',{name:title,exact:true}).click();await expect(page.getByText('Preserved note')).toBeVisible();await expect(page.getByRole('button',{name:/Favorite/iu})).toHaveAttribute('aria-pressed','true');
  const trigger=page.getByRole('button',{name:'Delete permanently'});await trigger.click();await page.getByRole('button',{name:'Cancel'}).click();await expect(page.getByRole('heading',{level:1,name:title})).toBeVisible();await trigger.click();await page.getByRole('alertdialog').getByRole('button',{name:'Delete permanently'}).click();await expect(page).toHaveURL('/');await expect(page.getByText(title)).toHaveCount(0);
});

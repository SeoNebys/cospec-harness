import { expect,test } from '@playwright/test';

const emptyNote={type:'doc',content:[{type:'paragraph'}]};
test('editing persists authored fields, formatted notes, favorite state, and searchable note text',async({page,request},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium','Editor keyboard and responsive behavior are covered separately.');
  const stamp=Date.now();const original=`Editable ${stamp}`;const updated=`Updated ${stamp}`;const note=`searchable context ${stamp}`;
  const created=await request.post('/api/bookmarks',{data:{url:`https://example.com/us4-${stamp}`,title:original,description:'Before',notes:emptyNote,tags:[],favorite:false,toRead:false}});const bookmark=await created.json();
  await page.goto(`/bookmarks/${bookmark.id}/edit`);await page.getByLabel('Title').fill(updated);await page.getByLabel('Description').fill('After');const tagInput=page.getByRole('combobox',{name:/Tags/iu});await tagInput.fill(`Tag ${stamp}`);await tagInput.press('Enter');await page.getByLabel('Favorite').check();const editor=page.getByRole('textbox',{name:'Notes'});await editor.fill(note);await editor.selectText();await page.getByRole('button',{name:'Bold'}).click();await page.getByRole('button',{name:'Save changes'}).click();
  await expect(page.getByRole('heading',{level:1,name:updated})).toBeVisible();await expect(page.locator('.formatted-note strong')).toContainText(note);await expect(page.getByRole('button',{name:/Favorite/iu})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('link',{name:'Bookmarks',exact:true}).click();await page.getByRole('searchbox').fill(note);await expect(page.getByRole('heading',{level:2,name:updated})).toBeVisible();
});

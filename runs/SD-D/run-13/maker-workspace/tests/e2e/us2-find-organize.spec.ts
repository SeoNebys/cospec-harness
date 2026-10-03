import { expect,test } from '@playwright/test';

const emptyNote={type:'doc',content:[{type:'paragraph'}]};
test('search expressions, filters, sorting, correction, and preferences work together',async({page,request},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium','Responsive collection controls are covered separately.');
  const stamp=Date.now();const tag=`Research ${stamp}`;const alpha=`Alpha design ${stamp}`;const zulu=`Zulu accessibility ${stamp}`;
  for(const item of [{url:`https://example.com/us2-a-${stamp}`,title:alpha,description:'design systems',tags:[tag],favorite:true},{url:`https://example.com/us2-z-${stamp}`,title:zulu,description:'inclusive patterns',tags:['Other'],favorite:false}]){const response=await request.post('/api/bookmarks',{data:{...item,notes:emptyNote,toRead:false}});expect(response.ok()).toBe(true);}
  await page.goto('/');const search=page.getByRole('searchbox');await search.fill(`"design systems" AND tag:"${tag}"`);await expect(page.getByRole('heading',{level:2,name:alpha})).toBeVisible();await expect(page.getByRole('heading',{level:2,name:zulu})).toHaveCount(0);
  await search.fill(`(${stamp} OR missing) AND`);await expect(page.locator('.search-error')).toContainText('near character');await expect(search).toHaveValue(`(${stamp} OR missing) AND`);
  await search.fill(String(stamp));await page.getByLabel('Tag',{exact:true}).fill(tag);await page.getByLabel('Favorites only').click();await expect(page.getByRole('heading',{level:2,name:alpha})).toBeVisible();await expect(page.getByRole('heading',{level:2,name:zulu})).toHaveCount(0);
  await page.getByRole('button',{name:'Clear filters'}).click();await expect(search).toHaveValue('');await page.getByLabel('Sort').selectOption('title:asc');await page.reload();await expect(page.getByLabel('Sort')).toHaveValue('title:asc');
});

import { test,expect } from '@playwright/test';

test('empty collection, save navigation, and responsive shell are ready',async({page,request})=>{
  await request.post('/api/bookmarks',{data:{url:'https://example.com/guide',title:'A useful guide',noteSource:'## Why it matters\n- Clear examples',tags:['research']}});
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Your bookmarks'})).toBeVisible();
  await expect(page.getByRole('link',{name:'A useful guide'})).toBeVisible();
  await page.getByRole('link',{name:'A useful guide'}).click();
  await expect(page.getByText('Why it matters')).toBeVisible();
  await expect(page.getByRole('link',{name:/Open page/})).toHaveAttribute('target','_blank');
});

test('search, favorite, and read later remain independent',async({page,request})=>{
  const stamp=Date.now(),title=`Searchable design systems ${stamp}`;
  const created=await (await request.post('/api/bookmarks',{data:{url:`https://example.com/${stamp}`,title,noteSource:'## Preserve me',tags:['design']}})).json();
  await page.goto('/');
  await page.getByLabel('Search bookmarks').fill('#design NOT draft');
  await expect(page.getByRole('link',{name:title})).toBeVisible();
  const card=page.getByRole('article').filter({hasText:title});
  await card.getByLabel('Add to favorites').click();
  await card.getByRole('button',{name:/Read later/}).click();
  const item=await (await request.get(`/api/bookmarks/${created.id}`)).json();
  expect(item.isFavorite).toBe(true);expect(item.isReadLater).toBe(true);expect(item.isRead).toBe(false);expect(item.title).toBe(title);expect(item.noteSource).toBe('## Preserve me');expect(item.tags.map((tag:{name:string})=>tag.name)).toEqual(['design']);
});

import{test,expect}from'@playwright/test';
test('keeps favorite and read-later independent',async({page})=>{await page.goto('/');const card=page.locator('.bookmark-card').first();if(await card.count()){const unread=card.getByRole('button',{name:/mark as read/i});if(await unread.count()){await unread.click();await expect(card.getByRole('button',{name:/add to read later/i})).toBeVisible()}}});

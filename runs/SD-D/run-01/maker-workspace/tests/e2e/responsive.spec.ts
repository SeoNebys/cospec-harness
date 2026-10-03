import{test,expect}from'@playwright/test';import{createAccount}from'./helpers';
test('authenticated shell has no horizontal overflow',async({page})=>{await createAccount(page);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);expect(overflow).toBe(false);});

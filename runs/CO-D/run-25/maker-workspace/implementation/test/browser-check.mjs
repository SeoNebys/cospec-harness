import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser=await chromium.launch({executablePath:'/opt/playwright-browsers/chromium-1228/chrome-linux64/chrome'}).catch(()=>chromium.launch());
const page=await browser.newPage({viewport:{width:1280,height:900}});
await page.goto(process.env.KEEPMARK_URL||'http://127.0.0.1:4100');
await page.locator('[data-harness-ready="true"]').waitFor();
await page.getByText('Your collection is empty').waitFor();

await page.locator('#urlInput').fill('not a web address');
await page.getByRole('button',{name:'Save bookmark'}).click();
await page.getByText('Could not save this address.').waitFor();
assert.equal(await page.locator('.card').count(),0);

await page.locator('#urlInput').fill('http://127.0.0.1:4100/');
await page.getByRole('button',{name:'Save bookmark'}).click();
await page.locator('.card').waitFor({timeout:12000});
await page.getByRole('button',{name:'Edit'}).click();
await page.locator('[data-label-input]').fill('Reference');
await page.locator('[data-label-input]').press('Enter');
await page.locator('[name="title"]').fill('Personal browser guide');
await page.locator('[name="note"]').fill('**Review**\n- Try the examples\n- Keep for later');
await page.getByRole('button',{name:'Save changes'}).click();
await page.getByText('Personal browser guide').waitFor();
assert.equal(await page.locator('.personal-note strong').innerText(),'Review');
assert.equal(await page.locator('.label-pill').innerText(),'Reference');

await page.locator('.card [data-action="later"]').click();
await page.locator('[data-view="later"]').click();
await page.getByText('Personal browser guide').waitFor();
assert.match(await page.locator('#count').innerText(),/1 bookmark/);
await page.getByRole('button',{name:'✓ Mark as read'}).click();
await page.getByText('Nothing waiting to be read').waitFor();

await page.locator('[data-view="all"]').first().click();
await page.locator('#searchInput').fill('PERSONAL and #reference');
await page.getByText('Personal browser guide').waitFor();
await page.locator('#sortSelect').selectOption('oldest');
await page.reload();await page.locator('[data-harness-ready="true"]').waitFor();
assert.equal(await page.locator('#sortSelect').inputValue(),'oldest');
await page.getByText('Personal browser guide').waitFor();

await page.getByRole('button',{name:'Remove'}).click();
await page.locator('#deleteDialog').getByRole('button',{name:'Remove bookmark'}).click();
await page.getByText('Your collection is empty').waitFor();
console.log('Browser check passed: save, edit, formatted note, labels, search, Read later, persistence, and deletion');
await browser.close();

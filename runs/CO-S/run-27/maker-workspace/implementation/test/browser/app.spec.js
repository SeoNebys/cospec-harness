import { test, expect } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs/promises';

let fixtureServer;
test.beforeAll(async()=>{
  await fs.writeFile('/tmp/keeplist-playwright-bookmarks.json','[]\n');
  fixtureServer=http.createServer((request,response)=>{ response.writeHead(200,{'content-type':'text/html'}); response.end('<html><head><title>Fixture article</title><meta name="description" content="A practical fixture about browser testing"></head><body>Fixture</body></html>'); });
  await new Promise(resolve=>fixtureServer.listen(43210,'127.0.0.1',resolve));
});
test.afterAll(async()=>{ await new Promise(resolve=>fixtureServer.close(resolve)); await fs.rm('/tmp/keeplist-playwright-bookmarks.json',{force:true}); });

test('approved bookmark journey works end to end',async({page})=>{
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();
  await expect(page.getByText('No bookmarks yet')).toBeVisible();

  await page.locator('#url-input').fill('not a web address');
  await expect(page.getByText('That doesn’t look like a complete web address.')).toBeVisible();
  await expect(page.locator('#fetch-button')).toBeDisabled();

  const address='http://127.0.0.1:43210/article';
  await page.locator('#url-input').fill(address);
  await expect(page.locator('#title-input')).toHaveValue('Fixture article');
  await expect(page.locator('#description-input')).toHaveValue('A practical fixture about browser testing');
  await page.locator('#tag-input').fill(' Reference ');
  await page.locator('#tag-input').press('Enter');
  await page.locator('#save-button').click();
  await expect(page.getByRole('link',{name:'Fixture article'})).toBeVisible();
  await expect(page.locator('.filter-tag',{hasText:'reference'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Fixture article'})).toHaveAttribute('target','_blank');

  await page.locator('#search-input').fill('browser testing');
  await expect(page.getByRole('link',{name:'Fixture article'})).toBeVisible();
  await page.locator('#search-input').fill('quantum penguins');
  await expect(page.getByText('No bookmarks match your search')).toBeVisible();
  await page.locator('#search-input').fill('');
  await expect(page.getByRole('link',{name:'Fixture article'})).toBeVisible();

  await page.locator('.filter-tag',{hasText:'reference'}).click();
  await expect(page.locator('#active-filter')).toContainText('reference');
  await page.locator('#active-filter button').click();

  await page.locator('[data-star]').click();
  await expect(page.getByText('Added to Read later.')).toBeVisible();
  await page.locator('[data-view="later"]').click();
  await expect(page.getByRole('link',{name:'Fixture article'})).toBeVisible();
  await page.locator('[data-star]').click();
  await expect(page.getByText('Removed from Read later.')).toBeVisible();
  await expect(page.getByText('Nothing saved for later yet')).toBeVisible();
  await page.getByRole('button',{name:'Browse all bookmarks'}).click();

  await page.locator('[data-edit]').click();
  await page.locator('#edit-title').fill('Updated fixture article');
  await page.getByRole('button',{name:'Save changes'}).click();
  await expect(page.getByRole('link',{name:'Updated fixture article'})).toBeVisible();
  await expect(page.getByText('Bookmark updated.')).toBeVisible();

  await page.locator('#url-input').fill(address);
  await expect(page.locator('#edit-dialog')).toBeVisible();
  await expect(page.locator('#edit-title')).toHaveValue('Updated fixture article');
  await page.locator('#edit-dialog [data-close]').first().click();

  await page.locator('[data-delete]').click();
  await expect(page.getByText('Delete this bookmark?')).toBeVisible();
  await page.getByRole('button',{name:'Delete bookmark'}).click();
  await expect(page.getByText('Bookmark deleted.')).toBeVisible();
  await expect(page.getByText('No bookmarks yet')).toBeVisible();
});

test('metadata and save failures preserve a recoverable bookmark',async({page})=>{
  await page.route('**/api/metadata',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({duplicate:false,url:'https://offline.example/article',title:'offline.example',description:'',fetched:false})}));
  let saveAttempts=0;
  await page.route('**/api/bookmarks',async route=>{
    if(route.request().method()==='POST' && saveAttempts++===0) return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Temporary save problem.'})});
    return route.continue();
  });
  await page.goto('/');
  await page.locator('#url-input').fill('https://offline.example/article');
  await expect(page.locator('#fetch-notice')).toContainText('couldn’t get this page’s details');
  await page.locator('#title-input').fill('Offline article');
  await page.locator('#description-input').fill('Details entered by hand');
  await page.locator('#save-button').click();
  await expect(page.locator('#url-message')).toContainText('Your details are still here');
  await expect(page.locator('#title-input')).toHaveValue('Offline article');
  await expect(page.locator('#description-input')).toHaveValue('Details entered by hand');
  await page.getByRole('button',{name:'Try again'}).click();
  await expect(page.getByRole('link',{name:'Offline article'})).toBeVisible();
});

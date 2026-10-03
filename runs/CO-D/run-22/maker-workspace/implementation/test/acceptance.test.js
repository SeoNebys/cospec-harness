'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

async function waitFor(url) { for(let i=0;i<40;i++){try{if((await fetch(url)).ok)return}catch{}await new Promise(r=>setTimeout(r,100))}throw Error('Server did not start') }

test('approved collection journeys work together', { timeout: 30000 }, async t => {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'trove-acceptance-'));
  const source=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end('<html><head><title>Captured test article</title><meta name="description" content="A page captured for acceptance"><meta property="og:site_name" content="Example Journal"></head><body><h1>Captured test article</h1><p>The hidden kestrel phrase remains searchable in this saved copy.</p></body></html>')});
  await new Promise(r=>source.listen(4199,'127.0.0.1',r));
  const child=spawn(process.execPath,['implementation/server.js'],{cwd:path.join(__dirname,'../..'),env:{...process.env,PORT:'4100',TROVE_DATA_DIR:temp},stdio:'ignore'});
  t.after(()=>{child.kill();source.close();fs.rmSync(temp,{recursive:true,force:true})});
  await waitFor('http://127.0.0.1:4100/api/state');
  const browser=await chromium.launch({headless:true,executablePath:'/opt/playwright-browsers/chromium-1228/chrome-linux64/chrome'});t.after(()=>browser.close());
  const page=await browser.newPage();page.setDefaultTimeout(7000);await page.goto('http://127.0.0.1:4100');await page.locator('[data-harness-ready=true]').waitFor();

  // SCN-001, SCN-017, SCN-026: automatic context, optional Read later, preserved searchable text.
  await page.fill('#url','http://127.0.0.1:4199/article');await page.check('#save-later');await page.getByRole('button',{name:'Save bookmark'}).click();await page.getByText('Captured test article',{exact:true}).waitFor();
  let saved=await (await fetch('http://127.0.0.1:4100/api/state')).json();const captured=saved.bookmarks.find(b=>b.title==='Captured test article');assert.equal(captured.site,'Example Journal');assert.match(captured.pageText,/hidden kestrel phrase/);assert.ok(captured.capturePath);assert.equal(captured.readStatus,'later');

  // SCN-007/008/029: case-insensitive preserved-text search and safe syntax recovery.
  await page.fill('#search','KESTREL');await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByText('Captured test article',{exact:true}).waitFor();assert.match(await page.locator('.match').first().innerText(),/saved page/i);const validResults=await page.locator('.card').count();
  await page.fill('#search','kestrel AND (');await page.getByRole('button',{name:'Search',exact:true}).click();assert.match(await page.locator('.search-error').innerText(),/unclosed parenthesis/i);assert.equal(await page.locator('.card').count(),validResults);

  // SCN-016/031: finish the last queued item and undo without deletion.
  await page.locator('[data-view=later]').click();const waiting=await page.locator('.card').count();assert.ok(waiting>=1);for(let i=0;i<waiting;i++){await page.locator('[data-finish]').first().click();await page.waitForTimeout(50)}await page.getByText('You’re all caught up').waitFor();await page.locator('#undo').click();await page.locator('.card').waitFor();

  // SCN-040: preferences preview and persistence.
  await page.locator('[data-view=preferences]').click();await page.selectOption('#pref-size','48');await page.selectOption('#pref-order','title');await page.selectOption('#pref-text','large');assert.match(await page.locator('#pref-summary').innerText(),/48 at once · Title A–Z/);await page.getByRole('button',{name:'Save preferences'}).click();saved=await (await fetch('http://127.0.0.1:4100/api/state')).json();assert.deepEqual(saved.preferences,{pageSize:48,order:'title',textSize:'large'});

  // SCN-021/034: permanent deletion removes the retained copy as well as collection data.
  await page.locator('[data-view=all]').click();await page.fill('#search','kestrel');await page.getByRole('button',{name:'Search',exact:true}).click();await page.locator(`[data-delete="${captured.id}"]`).click();await page.getByRole('button',{name:'Delete permanently'}).click();await page.waitForTimeout(100);saved=await (await fetch('http://127.0.0.1:4100/api/state')).json();assert.equal(saved.bookmarks.some(b=>b.id===captured.id),false);assert.equal((await fetch(`http://127.0.0.1:4100${captured.capturePath}`)).status,404);

  // SCN-036: Select all shown is bounded by the saved page-size preference.
  const template=saved.bookmarks[0];for(let i=0;i<15;i++)saved.bookmarks.push({...template,id:`bulk-${i}`,url:`https://bulk.example/${i}`,normalizedUrl:`https://bulk.example/${i}`,title:`Bulk ${i}`,createdAt:new Date(2020,0,i+1).toISOString()});saved.preferences.pageSize=12;await fetch('http://127.0.0.1:4100/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(saved)});await page.reload();await page.locator('[data-harness-ready=true]').waitFor();await page.locator('#select-all').click();await page.getByText('12 selected',{exact:true}).waitFor();
});

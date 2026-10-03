import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const dataFile = `/tmp/link-home-acceptance-${process.pid}.json`;
let flakyCalls = 0;
const pages = {
  '/mdn': ['JavaScript | MDN','Guides and references for the JavaScript language.','<h1>JavaScript</h1><p>Closures combine a function with surrounding state.</p>'],
  '/rome': ['A Weekend in Rome','A modern guide to neighborhoods and cafés in Rome.','<h1>A Weekend in Rome</h1><p>Modern Rome.</p>'],
  '/spqr': ['SPQR book notes','A book about ancient Rome.','<h1>SPQR</h1><p>Ancient Rome.</p>'],
  '/roman': ['A Roman Holiday for the Weekend','Reflections on a slow trip.','<h1>A Roman Holiday for the Weekend</h1>'],
  '/long': ['A deeply researched guide to resilient archives','This extensive guide examines practical ways to preserve web research, organize source material, document context, and keep a personal archive understandable over many years.','<h1>Archives</h1><p>Long form content.</p>']
};
const fixture = http.createServer((req,res)=>{
  if(req.url.startsWith('/failed')){res.writeHead(500);return res.end('unavailable')}
  if(req.url.startsWith('/flaky')){flakyCalls++;res.writeHead(200,{'content-type':'text/html'});return res.end(flakyCalls===1?'<title>Flaky page</title>':'<title>Flaky page</title><article><h1>Readable now</h1><p>Recovered copy.</p></article>')}
  const key=Object.keys(pages).find(x=>req.url.startsWith(x));const page=pages[key]||['Example page','Example description','<h1>Example</h1><p>Readable.</p>'];
  res.writeHead(200,{'content-type':'text/html'});res.end(`<title>${page[0]}</title><meta name="description" content="${page[1]}"><article>${page[2]}</article>`);
});
await new Promise(resolve=>fixture.listen(4600,'127.0.0.1',resolve));
const app=spawn(process.execPath,['implementation/server.js'],{cwd:'/work',env:{...process.env,PORT:'4100',DATA_FILE:dataFile},stdio:['ignore','pipe','pipe']});
async function wait(){for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:4100/api/bookmarks')).ok)return}catch{}await new Promise(r=>setTimeout(r,100))}throw Error('app did not start')}
const json=async(url,options={})=>{const r=await fetch(`http://127.0.0.1:4100${url}`,{headers:{'content-type':'application/json'},...options});const body=await r.json();return{r,body}};
let browser;
try{
  await wait();browser=await chromium.launch({headless:true});const page=await browser.newPage();await page.goto('http://127.0.0.1:4100/');await page.locator('[data-harness-ready="true"]').waitFor();
  // SCN-015 malformed save.
  await page.locator('#save-url').fill('not a web address');await page.locator('#save-form button').click();await page.getByText(/Enter a complete web address/).waitFor();assert.equal(await page.locator('.card').count(),0);
  // SCN-001, 002, 003, 019, 022: enriched save, copy, original page, equivalent duplicate.
  const mdn='http://127.0.0.1:4600/mdn';await page.locator('#save-url').fill(mdn);await page.locator('#save-form button').click();await page.getByRole('heading',{name:'JavaScript | MDN'}).waitFor();await page.getByText(/Saved with page copy/).waitFor();
  let all=(await json('/api/bookmarks')).body;assert.equal(all.length,1);const mdnItem=all[0];
  const popupWait=page.waitForEvent('popup');await page.locator('.card .source').click();const popup=await popupWait;assert.match(popup.url(),/\/mdn/);await popup.close();
  await page.locator('#save-url').fill(`${mdn}?utm_source=mail#closures`);await page.locator('#save-form button').click();await page.getByText('You already saved this link. Here it is.').waitFor();assert.equal((await json('/api/bookmarks')).body.length,1);
  // SCN-004, 005, 020: quick labels and established casing.
  await page.locator('.quick-label input').fill('reference');await page.locator('.quick-label button').click();await page.getByText('Label added.').waitFor();await page.locator('.quick-label input').fill('REFERENCE');await page.locator('.quick-label button').click();await page.getByText('Existing label reused with its established spelling.').waitFor();all=(await json('/api/bookmarks')).body;assert.deepEqual(all[0].labels,['reference']);
  // SCN-010, 011, 026: atomic editor, note search, saved details.
  await page.getByRole('button',{name:'Edit bookmark'}).click();await page.locator('#edit-title').fill('Changed title');await page.locator('#edit-note').fill('Review closures section');await page.locator('#edit-url').fill('bad address');await page.locator('#save-edit').click();await page.getByText(/Nothing has been saved yet/).waitFor();assert.equal((await json('/api/bookmarks')).body[0].title,'JavaScript | MDN');
  await page.locator('#edit-url').fill(mdn);await page.locator('#save-edit').click();await page.getByRole('heading',{name:'Changed title'}).waitFor();await page.locator('#search').fill('closures #reference');assert.equal(await page.locator('.card:visible').count(),1);
  // SCN-008, 009, 025: status movement and empty pile.
  await page.locator('#search').fill('');await page.getByRole('button',{name:'Mark done'}).click();await page.getByRole('heading',{name:'No To read bookmarks'}).waitFor();await page.getByRole('button',{name:/Done 1/}).click();await page.getByRole('heading',{name:'Changed title'}).waitFor();await page.getByRole('button',{name:'Move to To read'}).click();
  // SCN-016 metadata failure retains link; SCN-023 capture failure and retry.
  let out=await json('/api/bookmarks',{method:'POST',body:JSON.stringify({url:'http://127.0.0.1:4600/failed'})});assert.equal(out.r.status,201);assert.equal(out.body.bookmark.snapshotStatus,'failed');assert.equal(out.body.bookmark.title,'127.0.0.1');
  out=await json('/api/bookmarks',{method:'POST',body:JSON.stringify({url:'http://127.0.0.1:4600/flaky'})});assert.equal(out.body.bookmark.snapshotStatus,'failed');const flaky=out.body.bookmark;out=await json(`/api/bookmarks/${flaky.id}/snapshot/retry`,{method:'POST'});assert.equal(out.body.snapshotStatus,'ready');
  // Populate advanced-search examples and labels.
  const add=async(path,label,note='')=>{let x=await json('/api/bookmarks',{method:'POST',body:JSON.stringify({url:`http://127.0.0.1:4600${path}`})});let b=x.body.bookmark;await json(`/api/bookmarks/${b.id}/labels`,{method:'POST',body:JSON.stringify({label})});if(note)await json(`/api/bookmarks/${b.id}`,{method:'PUT',body:JSON.stringify({...b,note,labels:[label]})});return b};
  await add('/rome','article');await add('/spqr','book');await add('/roman','essay');await add('/long','archive','A very long personal note about naming conventions, durable context, and reorganizing a history research collection next spring.');await page.reload();await page.locator('[data-harness-ready="true"]').waitFor();
  // SCN-006, 007, 012, 013, 014, 017, 018: filters and search language.
  await page.getByLabel('Filter by label').getByRole('button',{name:'reference'}).click();assert.equal(await page.locator('.card:visible').count(),1);await page.getByLabel('Filter by label').getByRole('button',{name:'All'}).click();
  await page.locator('#search').fill('rome AND (#article OR #book) AND NOT ancient');assert.equal(await page.locator('.card:visible').count(),1);await page.getByRole('heading',{name:'A Weekend in Rome'}).waitFor();
  await page.locator('#search').fill('"a weekend"');assert.equal(await page.locator('.card:visible').count(),1);
  await page.locator('#search').fill('saturn');await page.getByRole('heading',{name:'No matching bookmarks'}).waitFor();await page.getByRole('button',{name:'Clear search and label'}).click();
  const before=await page.locator('.card:visible').count();await page.locator('#search').fill('rome AND (');await page.getByText(/collection has not changed/).waitFor();assert.equal(await page.locator('.card:visible').count(),before);
  // SCN-024 long content expansion.
  await page.locator('#search').fill('resilient');const longCard=page.locator('.card:visible');await longCard.getByRole('button',{name:'Show more'}).click();assert.ok(await longCard.locator('.long-text').evaluate(el=>el.classList.contains('expanded')));
  // SCN-021 saved metadata does not drift (fixture changes are never re-read).
  assert.equal((await json('/api/bookmarks')).body.find(x=>x.id===mdnItem.id).title,'Changed title');
  console.log('26 approved scenario groups verified');
} finally { if(browser)await browser.close();app.kill('SIGTERM');fixture.close();await fs.rm(dataFile,{force:true}); }

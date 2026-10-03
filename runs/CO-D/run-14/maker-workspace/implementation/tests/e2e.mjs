import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/browser-node/node_modules/playwright');
const port = 4173;
const base = `http://127.0.0.1:${port}`;
const temp = await mkdtemp(join(tmpdir(), 'keepwell-e2e-'));
const child = spawn(process.execPath, ['server.js'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', PUBLIC_ORIGIN: base, KEEPWELL_DATA: join(temp, 'data.json'), KEEPWELL_SESSION_SECRET: 'e2e-secret' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverOutput = '';
child.stdout.on('data', chunk => { serverOutput += chunk; });
child.stderr.on('data', chunk => { serverOutput += chunk; });

async function ready() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { if ((await fetch(base)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start.\n${serverOutput}`);
}

let browser;
try {
  await ready();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(base, { waitUntil: 'networkidle' });

  // SCN-012 / SCN-015
  await page.getByLabel('Password').fill('wrong');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.locator('#loginError').waitFor({ state: 'visible' });
  if (!(await page.getByText('Check your email and password, then try again.').isVisible())) throw new Error('generic sign-in error missing');
  if ((await page.getByLabel('Email').inputValue()) !== 'alex@example.com') throw new Error('email was not retained');
  await page.getByLabel('Password').fill('bookmarks');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('heading', { name: 'Your library' }).waitFor();

  // SCN-018: invalid values stay in place and never create a bookmark.
  const initialCount = Number(await page.locator('#libraryCount').textContent());
  await page.getByLabel('Web address').fill('');
  await page.locator('#saveForm').getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Paste a web address to continue.').waitFor();
  await page.getByLabel('Web address').fill('notes from rome');
  await page.locator('#saveForm').getByRole('button', { name: 'Continue' }).click();
  await page.getByText(/complete web address/).waitFor();
  if ((await page.getByLabel('Web address').inputValue()) !== 'notes from rome') throw new Error('invalid address input was changed');
  if (Number(await page.locator('#libraryCount').textContent()) !== initialCount) throw new Error('invalid address created a bookmark');

  // SCN-001 / SCN-003 / SCN-004
  const uniqueUrl = `${base}/demo/original/rome?article=2`;
  await page.getByLabel('Web address').fill(uniqueUrl);
  await page.locator('#saveForm').getByRole('button', { name: 'Continue' }).click();
  await page.locator('#bookmarkDialog').getByRole('heading', { name: 'Review before saving' }).waitFor();
  if (!(await page.locator('#bookmarkDescriptionInput').inputValue()).includes('Rome')) throw new Error('discovered description missing from review');
  await page.locator('#bookmarkTitleInput').fill('My edited Rome guide');
  await page.locator('#bookmarkDescriptionInput').fill('My tidied description');
  await page.locator('#bookmarkNotesInput').fill('A private note kept with this link');
  await page.locator('#bookmarkTagInput').fill('tra');
  await page.getByRole('button', { name: 'travel', exact: true }).click();
  await page.locator('#bookmarkTagInput').fill('Florence');
  await page.getByRole('button', { name: 'Create new tag “florence”' }).click();
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await page.getByRole('heading', { name: 'My edited Rome guide' }).waitFor();
  const createdCard = page.locator('.bookmark-card').filter({ hasText: 'My edited Rome guide' });
  if (!(await createdCard.getByText('florence', { exact: true }).isVisible())) throw new Error('new tag missing');
  if (!(await createdCard.getByText('travel', { exact: true }).isVisible())) throw new Error('existing tag missing');
  if (!(await createdCard.getByText('My tidied description', { exact: true }).isVisible())) throw new Error('edited description missing');

  // SCN-004 / SCN-016: the new tag is reusable and meaningful query parameters remain distinct.
  const secondUrl = `${base}/demo/original/rome?article=3`;
  await page.getByLabel('Web address').fill(secondUrl);
  await page.locator('#saveForm').getByRole('button', { name: 'Continue' }).click();
  await page.locator('#bookmarkTagInput').fill('flo');
  await page.getByRole('button', { name: 'florence', exact: true }).click();
  await page.locator('#bookmarkTitleInput').fill('A genuinely different Rome page');
  await page.getByRole('button', { name: 'Save bookmark' }).click();
  await page.getByRole('heading', { name: 'A genuinely different Rome page' }).waitFor();

  // SCN-002 / SCN-016
  await page.getByLabel('Web address').fill(`${uniqueUrl}&utm_source=newsletter`);
  await page.locator('#saveForm').getByRole('button', { name: 'Continue' }).click();
  await page.locator('#bookmarkDialog').getByText('Already in your library', { exact: true }).first().waitFor();
  if ((await page.locator('#bookmarkNotesInput').inputValue()) !== 'A private note kept with this link') throw new Error('duplicate flow lost existing notes');
  if (Number(await page.locator('#libraryCount').textContent()) !== initialCount + 2) throw new Error('tracking variant created a duplicate');
  await page.locator('#bookmarkDialog').getByRole('button', { name: 'Cancel' }).click();

  // SCN-013: an unreachable page can still enter the library in a visible waiting state.
  await page.getByLabel('Web address').fill('https://offline.invalid/article');
  await page.locator('#saveForm').getByRole('button', { name: 'Continue' }).click();
  await page.locator('#bookmarkDialog').getByRole('heading', { name: 'Save this address for now' }).waitFor();
  await page.locator('#bookmarkTitleInput').fill('Offline article to revisit');
  await page.locator('#bookmarkNotesInput').fill('Keep trying automatically');
  await page.getByRole('button', { name: 'Save for now' }).click();
  const pending = page.locator('.bookmark-card').filter({ hasText: 'Offline article to revisit' });
  await pending.getByText(/Waiting for page/).waitFor();

  // SCN-005–SCN-008 / SCN-014
  await page.getByLabel('Search your library').fill('ROME');
  await page.locator('#searchForm').getByRole('button', { name: 'Search' }).click();
  const broadCount = await page.locator('.bookmark-card').count();
  if (broadCount < 2) throw new Error('case-insensitive broad search did not match across the library');
  await page.getByLabel('Search your library').fill('Rome AND (tag:articles OR tag:books) AND NOT tag:travel');
  await page.locator('#searchForm').getByRole('button', { name: 'Search' }).click();
  await page.locator('#interpretation').waitFor();
  await page.waitForFunction(() => document.querySelector('#interpretationText')?.textContent.includes('travel'));
  if (!/exclude[^·]*travel/i.test(await page.locator('#interpretationText').textContent())) throw new Error('search interpretation omitted exclusion');
  const validResultCount = await page.locator('.bookmark-card').count();
  await page.getByLabel('Search your library').fill('Rome AND (tag:articles OR');
  await page.locator('#searchForm').getByRole('button', { name: 'Search' }).click();
  await page.locator('#searchError').waitFor({ state: 'visible' });
  if ((await page.locator('.bookmark-card').count()) !== validResultCount) throw new Error('malformed search disturbed prior results');
  await page.locator('#clearSearch').click();
  await page.getByLabel('Search your library').fill('tag:astronomy');
  await page.locator('#searchForm').getByRole('button', { name: 'Search' }).click();
  await page.getByRole('heading', { name: 'No bookmarks match' }).waitFor();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.waitForFunction(expected => document.querySelectorAll('.bookmark-card').length === expected, initialCount + 3);
  if ((await page.locator('.bookmark-card').count()) !== initialCount + 3) throw new Error('clearing zero-result search did not restore the full library');

  // SCN-011: cards are skimmable and original links leave this tab untouched.
  const seededRome = page.locator('.bookmark-card').filter({ hasText: 'A local’s walking guide to Rome' });
  if (!(await seededRome.locator('.bookmark-description').textContent()).includes('Quiet streets')) throw new Error('card description missing');
  if (!(await seededRome.getByText('articles', { exact: true }).isVisible())) throw new Error('card tags missing');
  if ((await seededRome.locator('.bookmark-title a').getAttribute('target')) !== '_blank') throw new Error('original does not open in a separate tab');

  // SCN-009 / SCN-017
  const water = page.locator('.bookmark-card').filter({ hasText: 'How ancient cities managed water' });
  await water.getByRole('button', { name: '+ Read later' }).click();
  await page.locator('.nav-button[data-section="later"]').click();
  await page.locator('#sectionTitle').getByText('Read later', { exact: true }).waitFor();
  while (await page.getByRole('button', { name: 'Mark read' }).count()) {
    const first = page.getByRole('button', { name: 'Mark read' }).first().locator('xpath=ancestor::article');
    const id = await first.getAttribute('data-id');
    const card = page.locator(`.bookmark-card[data-id="${id}"]`);
    await card.getByRole('button', { name: 'Mark read' }).click();
    await card.waitFor({ state: 'detached' });
  }
  await page.getByRole('heading', { name: 'You’re all caught up' }).waitFor();
  if (!(await page.getByText('Your bookmarks are safe in the library whenever you need them.').isVisible())) throw new Error('empty read-later reassurance missing');
  await page.getByRole('button', { name: 'Browse library' }).click();
  await page.getByRole('heading', { name: 'How ancient cities managed water' }).waitFor();

  // SCN-010
  await page.locator('.nav-button[data-section="library"]').click();
  const trees = page.locator('.bookmark-card').filter({ hasText: 'Why old city trees' });
  await trees.getByRole('button', { name: 'Why old city trees outlive the streets around them' }).click();
  await page.getByRole('heading', { name: 'This page can’t be reached anymore' }).waitFor();
  await page.getByRole('button', { name: 'Open saved copy' }).click();
  await page.locator('#archiveDialog').getByRole('heading', { name: 'Why old city trees outlive the streets around them' }).waitFor();
  await page.locator('#archiveByline').getByText(/Elena Marin/).waitFor();
  await page.locator('#archiveProvenance').getByText(/Captured .* from/).waitFor();
  await page.locator('#archiveBody').getByText(/living record/).waitFor();
  await page.locator('#archiveClose').click();

  // SCN-019 / SCN-021
  const edited = page.locator('.bookmark-card').filter({ hasText: 'My edited Rome guide' });
  const editedId = await edited.getAttribute('data-id');
  const beforeEdit = await page.evaluate(async id => ({ bookmark: (await (await fetch('/api/bookmarks')).json()).bookmarks.find(item => item.id === id), archive: (await (await fetch(`/api/bookmarks/${id}/archive`)).json()).archive }), editedId);
  await edited.getByRole('button', { name: 'Edit' }).click();
  await page.locator('#bookmarkTitleInput').fill('Unsaved title');
  await page.locator('#bookmarkDialog').getByRole('button', { name: 'Cancel' }).click();
  if (!(await page.getByRole('heading', { name: 'My edited Rome guide' }).isVisible())) throw new Error('cancelled edit leaked');
  await edited.getByRole('button', { name: 'Edit' }).click();
  await page.locator('#bookmarkTitleInput').fill('Rome guide final');
  await page.locator('#bookmarkNotesInput').fill('Corrected after saving');
  await page.locator('#bookmarkTagInput').fill('rese');
  await page.getByRole('button', { name: 'research', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('heading', { name: 'Rome guide final' }).waitFor();
  const afterEdit = await page.evaluate(async id => ({ bookmark: (await (await fetch('/api/bookmarks')).json()).bookmarks.find(item => item.id === id), archive: (await (await fetch(`/api/bookmarks/${id}/archive`)).json()).archive }), editedId);
  if (afterEdit.bookmark.url !== beforeEdit.bookmark.url) throw new Error('editing changed the saved address');
  if (JSON.stringify(afterEdit.archive) !== JSON.stringify(beforeEdit.archive)) throw new Error('editing disturbed the saved copy');
  if (afterEdit.bookmark.notes !== 'Corrected after saving' || !afterEdit.bookmark.tags.includes('research')) throw new Error('edited notes or tags were not retained');

  // SCN-020 / SCN-021
  const finalCard = page.locator('.bookmark-card').filter({ hasText: 'Rome guide final' });
  await finalCard.getByRole('button', { name: 'Delete' }).click();
  await page.getByText(/removes the bookmark, your notes, its Read later membership, and the saved copy/i).waitFor();
  await page.locator('#deleteDialog').getByRole('button', { name: 'Cancel' }).click();
  if (!(await page.getByRole('heading', { name: 'Rome guide final' }).isVisible())) throw new Error('cancelled delete removed bookmark');
  const afterCancelDelete = await page.evaluate(async id => ({ bookmark: (await (await fetch('/api/bookmarks')).json()).bookmarks.find(item => item.id === id), archive: (await (await fetch(`/api/bookmarks/${id}/archive`)).json()).archive }), editedId);
  if (JSON.stringify(afterCancelDelete) !== JSON.stringify(afterEdit)) throw new Error('cancelled delete changed stored bookmark data');
  await finalCard.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await page.getByRole('heading', { name: 'Rome guide final' }).waitFor({ state: 'detached' });
  const deletedStatus = await page.evaluate(async id => (await fetch(`/api/bookmarks/${id}/archive`)).status, editedId);
  if (deletedStatus !== 404) throw new Error('permanent delete left the saved copy behind');

  await page.setViewportSize({ width: 390, height: 844 });
  if ((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) > 1) throw new Error('mobile layout overflows horizontally');
  console.log('Keepwell browser acceptance flow: ok');
} finally {
  if (browser) await browser.close();
  child.kill('SIGTERM');
  await rm(temp, { recursive: true, force: true });
}

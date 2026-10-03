import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { STORAGE_KEY } from '../public/storage.js';

const port = Number(process.env.ACCEPTANCE_PORT || 4100);
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe']
});

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(base);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Acceptance server did not start');
}

const baseState = () => ({ bookmarks: [], collections: [] });
const bookmark = (id, name, url, collectionId = null) => ({ id, name, url, collectionId });
const collection = (id, name) => ({ id, name });

let browser;
let passed = 0;

async function pageWithState(state = baseState()) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(base);
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [STORAGE_KEY, state]);
  await page.reload();
  await page.locator('[data-harness-ready="true"]').waitFor();
  return { context, page };
}

async function run(name, task) {
  const resources = await pageWithState(task.state?.() ?? baseState());
  try {
    await task.test(resources.page, resources.context);
    passed += 1;
    process.stdout.write(`✓ ${name}\n`);
  } finally {
    await resources.context.close();
  }
}

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  await run('SCN-001 saves a named link from an empty collection', {
    test: async (page) => {
      await page.getByRole('button', { name: 'Add your first bookmark' }).click();
      await page.getByLabel('Name', { exact: true }).fill('MDN Web Docs');
      await page.getByLabel('Web address', { exact: true }).fill('https://developer.mozilla.org');
      await page.getByRole('button', { name: 'Save bookmark' }).click();
      await assertText(page.locator('.bookmark-name'), 'MDN Web Docs');
      await assertText(page.locator('.bookmark-url'), 'https://developer.mozilla.org');
      await assertText(page.locator('#total-number'), '1');
      await assertText(page.locator('#toast-message'), 'Bookmark saved to your collection');
    }
  });

  await run('SCN-002 groups selected bookmarks into a named collection', {
    state: () => ({
      collections: [],
      bookmarks: [
        bookmark('b1', 'MDN Web Docs', 'https://developer.mozilla.org'),
        bookmark('b2', 'CSS-Tricks', 'https://css-tricks.com'),
        bookmark('b3', 'Recipes', 'https://food.example')
      ]
    }),
    test: async (page) => {
      await page.getByLabel('Select MDN Web Docs').check();
      await page.getByLabel('Select CSS-Tricks').check();
      await page.getByRole('button', { name: 'Organize selected' }).click();
      await page.getByLabel('New collection name').fill('Web development');
      await page.getByRole('button', { name: 'Create collection' }).click();
      const section = page.locator('.collection-section.named');
      await assertText(section.locator('h3'), 'Web development');
      assert.equal(await section.locator('.bookmark-card').count(), 2);
    }
  });

  const findingState = () => ({
    collections: [collection('web', 'Web development'), collection('cook', 'Cooking')],
    bookmarks: [
      bookmark('b1', 'MDN Web Docs', 'https://developer.mozilla.org', 'web'),
      bookmark('b2', 'CSS-Tricks', 'https://css-tricks.com', 'web'),
      bookmark('b3', 'Weeknight recipes', 'https://food.example', 'cook')
    ]
  });

  await run('SCN-003 combines collection filtering and live search', {
    state: findingState,
    test: async (page) => {
      await page.getByRole('button', { name: /Web development/ }).click();
      assert.equal(await page.locator('.bookmark-card').count(), 2);
      await page.getByLabel('Search names and web addresses').fill('css');
      assert.equal(await page.locator('.bookmark-card').count(), 1);
      await assertText(page.locator('.bookmark-name'), 'CSS-Tricks');
      await assertText(page.locator('.view-heading h2'), 'Web development matching “css”');
    }
  });

  await run('SCN-004 deletes one bookmark and then several selected bookmarks', {
    state: () => ({
      collections: [],
      bookmarks: [
        bookmark('b1', 'One', 'https://one.example'),
        bookmark('b2', 'Two', 'https://two.example'),
        bookmark('b3', 'Three', 'https://three.example')
      ]
    }),
    test: async (page) => {
      await page.getByRole('button', { name: 'Delete One' }).click();
      await page.getByRole('button', { name: 'Delete bookmark', exact: true }).click();
      await assertText(page.locator('#total-number'), '2');
      await page.getByLabel('Select Two').check();
      await page.getByLabel('Select Three').check();
      await page.getByRole('button', { name: 'Delete selected' }).click();
      await page.getByRole('button', { name: 'Delete 2 bookmarks' }).click();
      await assertText(page.locator('#total-number'), '0');
      await assertText(page.locator('#toast-message'), '2 bookmarks deleted');
    }
  });

  await run('SCN-005 blocks invalid and duplicate saves without discarding input', {
    test: async (page) => {
      await page.getByRole('button', { name: 'Add your first bookmark' }).click();
      await page.getByLabel('Web address', { exact: true }).fill('developer.mozilla.org');
      await page.getByRole('button', { name: 'Save bookmark' }).click();
      await assertText(page.locator('#bookmark-name-error'), 'Add a name so you can recognize this bookmark.');
      assert.equal(await page.getByLabel('Web address', { exact: true }).inputValue(), 'developer.mozilla.org');
      await page.getByLabel('Name', { exact: true }).fill('MDN Web Docs');
      await page.getByLabel('Web address', { exact: true }).fill('https://developer.mozilla.org');
      await page.getByRole('button', { name: 'Save bookmark' }).click();
      await page.getByRole('button', { name: /Add bookmark/ }).click();
      await page.getByLabel('Name', { exact: true }).fill('MDN copy');
      await page.getByLabel('Web address', { exact: true }).fill('https://developer.mozilla.org/');
      await page.getByRole('button', { name: 'Save bookmark' }).click();
      await assertText(page.locator('#duplicate-bookmark-error'), 'This web address is already saved as “MDN Web Docs”.');
      await assertText(page.locator('#total-number'), '1');
    }
  });

  await run('SCN-006 explains no matches and clears search without clearing the collection', {
    state: findingState,
    test: async (page) => {
      await page.getByRole('button', { name: /Web development/ }).click();
      await page.getByLabel('Search names and web addresses').fill('recipe');
      await page.getByText('No bookmarks match that search').waitFor();
      await page.getByRole('button', { name: 'Clear search' }).click();
      assert.equal(await page.locator('.bookmark-card').count(), 2);
      assert.equal(await page.getByRole('button', { name: /Web development/ }).getAttribute('aria-pressed'), 'true');
    }
  });

  await run('SCN-007 adds a later bookmark to an existing collection', {
    state: () => ({
      collections: [collection('web', 'Web development')],
      bookmarks: [
        bookmark('b1', 'MDN', 'https://developer.mozilla.org', 'web'),
        bookmark('b2', 'CSS-Tricks', 'https://css-tricks.com', 'web'),
        bookmark('b3', 'web.dev Performance', 'https://web.dev/performance')
      ]
    }),
    test: async (page) => {
      await page.getByLabel('Select web.dev Performance').check();
      await page.getByRole('button', { name: 'Organize selected' }).click();
      await page.getByRole('button', { name: 'Add to collection' }).click();
      const section = page.locator('.collection-section.named');
      assert.equal(await section.locator('.bookmark-card').count(), 3);
      await assertText(page.locator('#toast-message'), 'Added to Web development');
    }
  });

  await run('SCN-008 rejects blank and duplicate collection names', {
    state: () => ({
      collections: [collection('web', 'Web development')],
      bookmarks: [
        bookmark('b1', 'One', 'https://one.example'),
        bookmark('b2', 'Two', 'https://two.example')
      ]
    }),
    test: async (page) => {
      await page.getByLabel('Select One').check();
      await page.getByLabel('Select Two').check();
      await page.getByRole('button', { name: 'Organize selected' }).click();
      await page.getByLabel('Create a new collection').check();
      await page.getByRole('button', { name: 'Create collection' }).click();
      await assertText(page.locator('#collection-name-error'), 'Add a name for this collection.');
      await page.getByLabel('New collection name').fill('web DEVELOPMENT');
      await page.getByRole('button', { name: 'Create collection' }).click();
      await assertText(page.locator('#duplicate-collection-error'), '“Web development” already exists. Add the selected bookmarks to it instead.');
      assert.equal(await page.locator('.bookmark-card.selected').count(), 2);
    }
  });

  await run('SCN-009 safely cancels deletion and returns to empty after deleting the last bookmark', {
    state: () => ({ collections: [], bookmarks: [bookmark('b1', 'MDN Web Docs', 'https://developer.mozilla.org')] }),
    test: async (page) => {
      await page.getByRole('button', { name: 'Delete MDN Web Docs' }).click();
      await page.getByRole('button', { name: 'Keep it' }).click();
      assert.equal(await page.locator('.bookmark-card').count(), 1);
      await assertText(page.locator('#total-number'), '1');
      await page.getByRole('button', { name: 'Delete MDN Web Docs' }).click();
      await page.getByRole('button', { name: 'Delete bookmark', exact: true }).click();
      await page.getByText('Your collection is empty').waitFor();
      await assertText(page.locator('#total-number'), '0');
      await page.getByRole('button', { name: 'Add your first bookmark' }).waitFor();
    }
  });

  await run('SCN-010 preserves saved content but resets transient state on reload', {
    state: findingState,
    test: async (page) => {
      await page.getByLabel('Search names and web addresses').fill('css');
      await page.getByLabel('Select CSS-Tricks').check();
      await page.getByRole('button', { name: /Add bookmark/ }).click();
      await page.getByLabel('Name', { exact: true }).fill('Half entered');
      await page.reload();
      await page.locator('[data-harness-ready="true"]').waitFor();
      await assertText(page.locator('#total-number'), '3');
      assert.equal(await page.getByLabel('Search names and web addresses').inputValue(), '');
      assert.equal(await page.locator('.bookmark-card.selected').count(), 0);
      assert.equal(await page.locator('#bookmark-dialog').getAttribute('open'), null);
      assert.equal(await page.getByRole('button', { name: /Web development/ }).count(), 1);
    }
  });

  await run('SCN-011 opens the whole bookmark card in a separate browser tab', {
    state: () => ({ collections: [], bookmarks: [bookmark('b1', 'Saved destination', `${base}/destination.html`)] }),
    test: async (page, context) => {
      const originalUrl = page.url();
      const popupPromise = context.waitForEvent('page');
      await page.locator('.bookmark-card').click({ position: { x: 180, y: 35 } });
      const popup = await popupPromise;
      await popup.waitForLoadState('domcontentloaded');
      assert.equal(popup.url(), `${base}/destination.html`);
      assert.equal(page.url(), originalUrl);
    }
  });

  await run('SCN-012 searches 121 bookmarks including complete long text', {
    state: () => ({
      collections: [collection('long', 'Design systems, inclusive interfaces, and accessibility research')],
      bookmarks: [
        bookmark('special', 'A comprehensive accessibility checklist for inclusive web interfaces, keyboard navigation, readable content, and assistive technology support', 'https://knowledge.example.org/a-very-long-reference-address-for-inclusive-web-interface-checklists', 'long'),
        ...Array.from({ length: 120 }, (_, index) => bookmark(`b${index}`, `Saved guide ${index}`, `https://reference.example/${index}`))
      ]
    }),
    test: async (page) => {
      await assertText(page.locator('#total-number'), '121');
      await page.getByLabel('Search names and web addresses').fill('accessibility');
      assert.equal(await page.locator('.bookmark-card').count(), 1);
      await assertText(page.locator('.view-heading span'), '1 result');
      assert.match(await page.locator('.bookmark-name').getAttribute('title'), /accessibility checklist/);
      const clamp = await page.locator('.bookmark-name').evaluate((node) => getComputedStyle(node).webkitLineClamp);
      assert.equal(clamp, '2');
    }
  });

  process.stdout.write(`\n${passed} acceptance scenarios passed.\n`);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}

async function assertText(locator, expected) {
  assert.equal((await locator.innerText()).trim(), expected);
}

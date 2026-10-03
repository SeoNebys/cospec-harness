import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';

import type { BookmarkList, MetadataPreview } from '../../src/shared/contracts.js';

const KEYBOARD_URL = 'https://example.test/accessible-keyboard-flow';

async function resetLibrary(request: APIRequestContext): Promise<void> {
  const response = await request.get('/api/bookmarks');
  expect(response.ok()).toBeTruthy();
  const list = (await response.json()) as BookmarkList;
  for (const bookmark of list.items) {
    expect((await request.delete(`/api/bookmarks/${bookmark.id}`)).ok()).toBeTruthy();
  }
}

async function installUnavailableMetadata(page: Page): Promise<void> {
  await page.route('**/api/page-metadata', async (route) => {
    const { url } = route.request().postDataJSON() as { url: string };
    const body: MetadataPreview = {
      requestedUrl: url,
      finalUrl: null,
      outcome: 'unavailable',
      title: null,
      description: null,
      message: 'Page information is unavailable. Enter a title manually.',
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

async function contrastRatio(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    interface Color {
      red: number;
      green: number;
      blue: number;
      alpha: number;
    }

    const parseColor = (value: string): Color => {
      const components = value.match(/[\d.]+/g)?.map(Number) ?? [];
      return {
        red: components[0] ?? 0,
        green: components[1] ?? 0,
        blue: components[2] ?? 0,
        alpha: components[3] ?? 1,
      };
    };
    const composite = (foreground: Color, background: Color): Color => {
      const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
      const channel = (front: number, back: number) =>
        alpha === 0
          ? 0
          : (front * foreground.alpha +
              back * background.alpha * (1 - foreground.alpha)) /
            alpha;
      return {
        red: channel(foreground.red, background.red),
        green: channel(foreground.green, background.green),
        blue: channel(foreground.blue, background.blue),
        alpha,
      };
    };
    const ancestors: Element[] = [];
    for (let current: Element | null = element; current; current = current.parentElement) {
      ancestors.push(current);
    }
    let background: Color = { red: 255, green: 255, blue: 255, alpha: 1 };
    for (const ancestor of ancestors.reverse()) {
      background = composite(
        parseColor(getComputedStyle(ancestor).backgroundColor),
        background,
      );
    }
    const foreground = composite(
      parseColor(getComputedStyle(element).color),
      background,
    );
    const luminance = (color: Color) => {
      const channel = (value: number) => {
        const normalized = value / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return (
        0.2126 * channel(color.red) +
        0.7152 * channel(color.green) +
        0.0722 * channel(color.blue)
      );
    };
    const light = Math.max(luminance(foreground), luminance(background));
    const dark = Math.min(luminance(foreground), luminance(background));
    return (light + 0.05) / (dark + 0.05);
  });
}

async function expectTextContrast(
  locator: Locator,
  label: string,
  minimum = 4.5,
): Promise<void> {
  await expect(locator).toBeVisible();
  expect.soft(await contrastRatio(locator), `${label} text contrast`).toBeGreaterThanOrEqual(
    minimum,
  );
}

async function expectVisibleFocusIndicator(locator: Locator): Promise<void> {
  await locator.focus();
  await expect(locator).toBeFocused();
  const indicator = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const rectangle = element.getBoundingClientRect();
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      boxShadow: style.boxShadow,
      fullyVisible:
        rectangle.top >= 0 &&
        rectangle.left >= 0 &&
        rectangle.bottom <= window.innerHeight &&
        rectangle.right <= window.innerWidth,
    };
  });
  expect(
    (indicator.outlineStyle !== 'none' && indicator.outlineWidth >= 1) ||
      indicator.boxShadow !== 'none',
  ).toBe(true);
  expect(indicator.fullyVisible).toBe(true);
}

test('exposes labelled landmarks, controls, tabs, and live regions in the ARIA tree', async ({
  page,
  request,
}) => {
  await resetLibrary(request);
  expect(
    (
      await request.post('/api/bookmarks', {
        data: {
          url: 'https://example.test/accessible-reference',
          title: 'Accessible reference',
          description: 'A reference used to inspect semantic bookmark output.',
          tags: ['Research'],
          readingState: 'to_read',
        },
      })
    ).status(),
  ).toBe(201);
  await installUnavailableMetadata(page);
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();

  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Your bookmarks, kept close.',
  );
  await expect(page.getByRole('region', { name: /find and organize bookmarks/i })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: /search bookmarks/i })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /research/i })).toBeVisible();
  await expect(page.getByRole('combobox', { name: /sort bookmarks/i })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Bookmarks' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Accessible reference' })).toBeVisible();

  const tablist = page.getByRole('tablist', { name: 'Bookmark views' });
  await expect(tablist).toMatchAriaSnapshot(`
    - tab "Library" [selected]
    - tab "Read Later"
  `);
  const libraryTab = tablist.getByRole('tab', { name: 'Library' });
  const panel = page.getByRole('tabpanel', { name: 'Library' });
  await expect(libraryTab).toHaveAttribute('aria-controls', 'library-tab-panel');
  await expect(panel).toHaveAttribute('aria-labelledby', 'library-tab');

  await page.getByRole('button', { name: /add bookmark/i }).click();
  const form = page.locator('form');
  await expect(form).toMatchAriaSnapshot(`
    - textbox "Web address"
    - textbox "Title"
    - textbox "Description"
    - textbox "Tags"
    - paragraph: Separate tags with commas.
    - combobox "Reading status":
      - option "Untracked" [selected]
      - option "To Read"
      - option "Read"
    - button "Cancel"
    - button "Save bookmark"
  `);
  const metadataStatus = form.getByRole('status');
  await expect(metadataStatus).toHaveAttribute('aria-live', 'polite');
});

test('keeps focus order, tab semantics, focus visibility, and critical contrast accessible', async ({
  page,
  request,
}) => {
  await resetLibrary(request);
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Trove home' })).toBeFocused();
  await page.keyboard.press('Tab');
  const addBookmark = page.getByRole('button', { name: /add bookmark/i });
  await expect(addBookmark).toBeFocused();
  await page.keyboard.press('Tab');
  const libraryTab = page.getByRole('tab', { name: 'Library' });
  const readLaterTab = page.getByRole('tab', { name: 'Read Later' });
  await expect(libraryTab).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('searchbox', { name: /search bookmarks/i })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('combobox', { name: /sort bookmarks/i })).toBeFocused();

  await libraryTab.focus();
  await page.keyboard.press('End');
  await expect(readLaterTab).toBeFocused();
  await expect(readLaterTab).toHaveAttribute('aria-selected', 'true');
  await expect(libraryTab).toHaveAttribute('tabindex', '-1');
  await page.keyboard.press('Home');
  await expect(libraryTab).toBeFocused();
  await expect(libraryTab).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(readLaterTab).toBeFocused();
  await expect(readLaterTab).toHaveAttribute('aria-selected', 'true');

  await expectVisibleFocusIndicator(addBookmark);
  await expectVisibleFocusIndicator(readLaterTab);
  await expectVisibleFocusIndicator(
    page.getByRole('searchbox', { name: /search bookmarks/i }),
  );
  await expectTextContrast(page.getByRole('heading', { level: 1 }), 'hero heading');
  await expectTextContrast(addBookmark, 'Add bookmark button');
  await expectTextContrast(readLaterTab, 'selected Read Later tab');
});

test('supports validation, saving, view switching, and completion using only the keyboard', async ({
  page,
  request,
}) => {
  await resetLibrary(request);
  await installUnavailableMetadata(page);
  await page.goto('/');
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible();

  const addBookmark = page.getByRole('button', { name: /add bookmark/i });
  await addBookmark.focus();
  await page.keyboard.press('Enter');
  const address = page.getByRole('textbox', { name: /web address/i });
  const title = page.getByRole('textbox', { name: /^title/i });
  await expect(address).toBeFocused();

  const save = page.getByRole('button', { name: /save bookmark/i });
  await save.focus();
  await page.keyboard.press('Enter');
  await expect(address).toBeFocused();
  await expect(address).toHaveAttribute('aria-invalid', 'true');
  await expect(address).toHaveAccessibleDescription(/absolute HTTP or HTTPS URL/i);
  await expect(title).toHaveAttribute('aria-invalid', 'true');
  await expect(title).toHaveAccessibleDescription(/enter a title/i);
  await expectTextContrast(page.locator('#url-error'), 'URL validation message');

  await page.keyboard.insertText(KEYBOARD_URL);
  const metadataStatus = page
    .getByRole('status')
    .filter({ hasText: /unavailable|enter a title manually/i });
  await expect(metadataStatus).toBeVisible();
  await expect(metadataStatus).toHaveAttribute('aria-live', 'polite');

  await page.keyboard.press('Tab');
  await expect(title).toBeFocused();
  await page.keyboard.insertText('Keyboard accessibility reference');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: /description/i })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: /^tags/i })).toBeFocused();
  await page.keyboard.press('Tab');
  const readingStatus = page.getByRole('combobox', { name: /reading status/i });
  await expect(readingStatus).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(readingStatus).toHaveValue('to_read');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(save).toBeFocused();
  await page.keyboard.press('Enter');

  const libraryTab = page.getByRole('tab', { name: 'Library' });
  const readLaterTab = page.getByRole('tab', { name: 'Read Later' });
  await expect(libraryTab).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(readLaterTab).toBeFocused();
  await expect(readLaterTab).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('searchbox', { name: /search bookmarks/i })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('combobox', { name: /sort bookmarks/i })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Keyboard accessibility reference' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  const markRead = page.getByRole('button', { name: /mark as read/i });
  await expect(markRead).toBeFocused();
  await page.keyboard.press('Enter');

  const emptyStatus = page.getByRole('status').filter({ hasText: /nothing to read later/i });
  await expect(emptyStatus).toBeVisible();
  await expect(page.getByRole('link', { name: 'Keyboard accessibility reference' })).toHaveCount(
    0,
  );
});

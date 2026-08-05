import { test, expect, _electron as electron } from '@playwright/test'

// A minimal end-to-end check that the packaged app actually boots and the core
// save flow works against a real window. Covers the top of quickstart.md.
// Requires a display and a build (see playwright.config.ts).
test('launches, shows the add form, and saves a bookmark', async () => {
  const app = await electron.launch({ args: ['.'] })
  const win = await app.firstWindow()

  await expect(win.locator('h1')).toHaveText('Bookmarks')
  const urlInput = win.locator('input[type="url"]')
  await expect(urlInput).toBeVisible()

  // Save a bookmark and confirm it appears in the list.
  await urlInput.fill('https://example.com/playwright-smoke')
  await win.getByRole('button', { name: 'Save' }).click()
  await expect(win.locator('.bookmark .url')).toContainText('example.com/playwright-smoke')

  await app.close()
})

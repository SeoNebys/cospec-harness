import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('keepwise-bookmarks')
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error)
  }))
  await page.reload()
})

test('save, validate, persist, and open a bookmark', async ({ page, context }) => {
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible()
  await page.getByRole('button', { name: 'Add your first bookmark' }).click()
  await page.getByRole('button', { name: 'Save bookmark' }).click()
  await expect(page.getByText('Give this bookmark a title.')).toBeVisible()
  await page.getByLabel(/Title/).fill('Example')
  await page.getByLabel(/Web address/).fill('example.com')
  await page.getByLabel(/Notes/).fill('Reference site')
  await page.getByLabel(/Tags/).fill('work, reference')
  await page.getByRole('button', { name: 'Save bookmark' }).click()
  await expect(page.getByRole('link', { name: /Example/ })).toBeVisible()
  await page.reload()
  const link = page.getByRole('link', { name: /Example/ })
  await expect(link).toHaveAttribute('href', 'https://example.com/')
  const popupPromise = context.waitForEvent('page')
  await link.click()
  const popup = await popupPromise
  expect(popup.url()).toContain('example.com')
})

test('warns before a duplicate is saved', async ({ page }) => {
  for (const title of ['First', 'Second']) {
    await page.getByRole('button', { name: '+ Add bookmark', exact: true }).click()
    await page.getByLabel(/Title/).fill(title)
    await page.getByLabel(/Web address/).fill('example.com')
    await page.getByRole('button', { name: 'Save bookmark' }).click()
  }
  await expect(page.getByText('You already saved this address')).toBeVisible()
  await page.getByRole('button', { name: 'Save duplicate' }).click()
  await expect(page.getByText('Showing 2 of 2')).toBeVisible()
})

import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => new Promise<void>((resolve) => { const r = indexedDB.deleteDatabase('keepwise-bookmarks'); r.onsuccess = () => resolve() }))
  await page.reload()
  await page.getByRole('button', { name: '+ Add bookmark', exact: true }).click()
  await page.getByLabel(/Title/).fill('Example'); await page.getByLabel(/Web address/).fill('example.com')
  await page.getByRole('button', { name: 'Save bookmark' }).click()
})

test('edits, cancels, and confirms deletion with persistence', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Example' }).click()
  await page.getByLabel(/Title/).fill('Updated')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.reload(); await expect(page.getByRole('link', { name: /Updated/ })).toBeVisible()
  await page.getByRole('button', { name: 'Delete Updated' }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('link', { name: /Updated/ })).toBeVisible()
  await page.getByRole('button', { name: 'Delete Updated' }).click()
  await page.getByRole('button', { name: 'Delete bookmark' }).click()
  await expect(page.getByText('Save your first good find')).toBeVisible()
  await page.reload(); await expect(page.getByText('Save your first good find')).toBeVisible()
})

test('cancels an edit without saving', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit Example' }).click()
  await page.getByLabel(/Title/).fill('Discarded')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('link', { name: /Example/ })).toBeVisible()
})

import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => new Promise<void>((resolve) => { const r = indexedDB.deleteDatabase('keepwise-bookmarks'); r.onsuccess = () => resolve() }))
  await page.reload()
  for (const item of [{ title: 'Design systems', url: 'design.example.com', tags: 'work, design' }, { title: 'Olive bread', url: 'food.example.com', tags: 'home' }]) {
    await page.getByRole('button', { name: '+ Add bookmark', exact: true }).click()
    await page.getByLabel(/Title/).fill(item.title); await page.getByLabel(/Web address/).fill(item.url); await page.getByRole('textbox', { name: /Tags/ }).fill(item.tags)
    await page.getByRole('button', { name: 'Save bookmark' }).click()
  }
})

test('searches, filters, combines, and clears criteria', async ({ page }) => {
  await page.getByLabel('Filter by tag').selectOption({ label: 'work (1)' })
  await expect(page.getByRole('link', { name: /Design systems/ })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search bookmarks' }).fill('bread')
  await expect(page.getByText('No bookmarks match that')).toBeVisible()
  await page.getByRole('button', { name: 'Clear search and filter' }).click()
  await expect(page.getByText('Showing 2 of 2')).toBeVisible()
})

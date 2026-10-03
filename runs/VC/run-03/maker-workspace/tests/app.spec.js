import { test, expect } from '@playwright/test'

test('fetches page details, saves, and edits a bookmark', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://127.0.0.1:4000')
  await expect(page.locator('[data-harness-ready="true"]')).toBeVisible()
  await expect(page.locator('.card')).toHaveCount(6)
  await page.getByRole('button', { name: 'Add bookmark' }).first().click()
  await page.locator('label').filter({ hasText: 'URL' }).locator('input').fill('https://example.com')
  await page.getByRole('button', { name: 'Fetch details' }).click()
  await expect(page.locator('label').filter({ hasText: 'Title' }).locator('input')).toHaveValue('Example Domain')
  await page.getByRole('button', { name: 'Save bookmark' }).click()
  await expect(page.getByText('Example Domain')).toBeVisible()
  await page.locator('.card').first().getByRole('button', { name: 'More options' }).click()
  await page.getByRole('button', { name: 'Edit' }).click()
  await page.locator('label').filter({ hasText: 'Title' }).locator('input').fill('Edited example')
  await page.locator('label').filter({ hasText: 'Tags' }).locator('input').fill('reference, useful')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Edited example')).toBeVisible()
  await expect(page.getByText('reference')).toBeVisible()
  expect(errors).toEqual([])
})

test('mobile navigation opens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://127.0.0.1:4000')
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(page.locator('aside')).toHaveClass(/open/)
})

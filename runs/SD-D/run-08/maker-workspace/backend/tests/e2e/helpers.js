import { expect } from '@playwright/test';

let counter = 0;
// Unique URL per call so tests are independent on the shared DB.
export function uniqueUrl(host = 'example.com') {
  counter += 1;
  return `https://${host}/e2e-${Date.now()}-${counter}`;
}

// Create a bookmark via the API (fast, deterministic seeding for E2E).
export async function createBookmark(request, body) {
  const res = await request.post('/api/bookmarks', { data: body });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

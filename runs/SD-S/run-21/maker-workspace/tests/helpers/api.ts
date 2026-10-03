import type { APIRequestContext } from "@playwright/test";
export async function createTestBookmark(
  request: APIRequestContext,
  title: string
) {
  const token = `${Date.now()}-${Math.random()}`;
  const response = await request.post("/api/bookmarks", {
    data: { url: `https://example.com/${token}`, title }
  });
  if (!response.ok())
    throw new Error(`Fixture creation failed: ${response.status()}`);
  return response.json();
}

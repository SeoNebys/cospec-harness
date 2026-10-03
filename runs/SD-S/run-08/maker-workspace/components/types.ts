export type Bookmark = {
  id: string; url: string; title: string; titleOrigin: "fetched" | "fallback" | "user";
  note: string; iconPath?: string | null; tags: string[]; createdAt: string; updatedAt: string;
};

export type Preview = {
  normalizedUrl: string; title: string; titleOrigin: "fetched" | "fallback";
  iconToken?: string | null; warning?: string | null; existingBookmarkId?: string | null;
};

export type ApiError = { error?: { code?: string; message?: string; field?: string; existingId?: string } };

export async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let body: ApiError = {};
    try { body = await response.json() as ApiError; } catch { /* use generic message */ }
    const error = new Error(body.error?.message || "Something went wrong. Please try again.");
    Object.assign(error, { status: response.status, existingId: body.error?.existingId });
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

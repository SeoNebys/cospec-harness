"use client";

let csrfToken: string | null = null;

export async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const response = await fetch("/api/csrf", { cache: "no-store" });
  if (!response.ok) throw new Error("Your session has expired. Please sign in again.");
  csrfToken = String((await response.json()).token);
  return csrfToken;
}

export async function apiMutation<T>(url: string, method: "POST" | "PATCH" | "DELETE", body: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json", "x-csrf-token": await getCsrfToken() },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.detail || data.title || "The request could not be completed.") as Error & { status?: number; data?: Record<string, unknown> };
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data as T;
}

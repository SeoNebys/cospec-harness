import type { Problem } from '../../shared/types/api';

export class ApiError extends Error {
  constructor(public readonly problem: Problem) {
    super(problem.detail);
  }
}

class ApiClient {
  private csrfToken: string | null = null;

  setCsrfToken(value: string | null): void {
    this.csrfToken = value;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const method = (init.method ?? 'GET').toUpperCase();
    const headers = new Headers(init.headers);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && this.csrfToken) {
      headers.set('X-CSRF-Token', this.csrfToken);
    }
    const response = await fetch(path, { ...init, headers, credentials: 'same-origin' });
    if (response.status === 204) return undefined as T;
    const value = (await response.json()) as T | Problem;
    if (!response.ok) throw new ApiError(value as Problem);
    return value as T;
  }
}

export const api = new ApiClient();

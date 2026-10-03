import type { Problem } from '../../shared/contracts/types.js';

export class ApiError extends Error { constructor(public problem: Problem) { super(problem.detail); } }
export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  if (!response.ok) throw new ApiError(await response.json() as Problem);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

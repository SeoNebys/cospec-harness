import type { Problem } from '../../shared/contracts/problems';

export class ApiError extends Error {
  constructor(
    public status: number,
    public problem: Problem,
  ) {
    super(problem.message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
  });
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({
      code: 'REQUEST_FAILED',
      message: 'The request could not be completed.',
    }))) as Problem;
    throw new ApiError(response.status, problem);
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}

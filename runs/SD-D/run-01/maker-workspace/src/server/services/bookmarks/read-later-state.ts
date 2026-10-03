export type ReadLaterState = 'none'|'unread'|'read';
export function transitionReadLater(current: {readLaterAddedAt:string|null;readAt:string|null}, next: ReadLaterState, now = new Date().toISOString()) {
  if (next === 'none') return { readLaterState: next, readLaterAddedAt: null, readAt: null };
  if (next === 'unread') return { readLaterState: next, readLaterAddedAt: current.readLaterAddedAt ?? now, readAt: null };
  return { readLaterState: next, readLaterAddedAt: current.readLaterAddedAt ?? now, readAt: now };
}

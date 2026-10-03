// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ReadingStateButton } from '../../src/client/features/bookmarks/ReadingStateButton';
it('marks a bookmark unread only through an explicit action', async () => {
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({}),
  });
  vi.stubGlobal('fetch', fetcher);
  const changed = vi.fn();
  render(<ReadingStateButton bookmark={{ id: '1', readingState: 'none' } as never} onChanged={changed} />);
  await userEvent.click(screen.getByRole('button', { name: 'Read later' }));
  expect(fetcher).toHaveBeenCalledWith('/api/bookmarks/1', expect.objectContaining({ method: 'PATCH' }));
  vi.unstubAllGlobals();
});

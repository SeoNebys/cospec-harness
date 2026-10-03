// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { BulkActionBar } from '../../src/client/features/bookmarks/BulkActionBar';
it('submits only explicit IDs and announces completion counts', async () => {
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ requestedCount: 2, changedIds: ['a'], unchangedIds: ['b'], failures: [] }),
  });
  vi.stubGlobal('fetch', fetcher);
  const complete = vi.fn();
  render(<BulkActionBar ids={['a', 'b']} archived={false} onComplete={complete} onDelete={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Mark unread' }));
  await waitFor(() => expect(complete).toHaveBeenCalledWith('1 changed, 1 already set, 0 failed.'));
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
    bookmarkIds: ['a', 'b'],
    action: 'markUnread',
  });
  vi.unstubAllGlobals();
});

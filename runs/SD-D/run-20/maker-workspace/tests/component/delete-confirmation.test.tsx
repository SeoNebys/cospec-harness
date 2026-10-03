// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { DeleteBookmarksDialog } from '../../src/client/features/bookmarks/DeleteBookmarksDialog';
it('states irreversible scope and allows cancel without mutation', async () => {
  const close = vi.fn();
  const confirm = vi.fn();
  render(<DeleteBookmarksDialog ids={['a', 'b']} open onClose={close} onConfirm={confirm} />);
  expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /2 bookmarks/ })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(close).toHaveBeenCalled();
  expect(confirm).not.toHaveBeenCalled();
});

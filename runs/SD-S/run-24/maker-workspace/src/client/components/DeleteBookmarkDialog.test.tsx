import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DeleteBookmarkDialog } from './DeleteBookmarkDialog.js';

describe('DeleteBookmarkDialog', () => {
  it('defaults to cancel and supports cancel without deletion', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <DeleteBookmarkDialog
        title="Example"
        open
        pending={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('requires the explicit permanent-delete action', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <DeleteBookmarkDialog
        title="Example"
        open
        pending={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

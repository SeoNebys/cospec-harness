import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BookmarkActions } from './BookmarkActions.js';

describe('BookmarkActions', () => {
  it('exposes edit, favorite, archive, restore, and delete actions', async () => {
    const user = userEvent.setup();
    const handlers = {
      onEdit: vi.fn(),
      onFavorite: vi.fn(),
      onArchive: vi.fn(),
      onDelete: vi.fn(),
    };
    const { rerender } = render(
      <BookmarkActions
        title="Example"
        isFavorite={false}
        isArchived={false}
        pending={false}
        {...handlers}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Favorite Example' }));
    await user.click(screen.getByRole('button', { name: 'Archive Example' }));
    await user.click(screen.getByRole('button', { name: 'Edit Example' }));
    await user.click(screen.getByRole('button', { name: 'Delete Example' }));
    expect(Object.values(handlers).every((handler) => handler.mock.calls.length === 1)).toBe(true);

    rerender(
      <BookmarkActions title="Example" isFavorite isArchived pending={false} {...handlers} />,
    );
    expect(
      screen.getByRole('button', { name: 'Remove Example from favorites' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore Example' })).toBeInTheDocument();
  });
});

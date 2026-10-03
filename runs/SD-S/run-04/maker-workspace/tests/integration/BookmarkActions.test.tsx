// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeleteBookmarkDialog } from '../../src/client/features/bookmarks/DeleteBookmarkDialog';
const bookmark = {
  id: '00000000-0000-4000-8000-000000000001',
  url: 'https://example.com',
  title: 'A keeper',
  notes: '',
  tags: [],
  domain: 'example.com',
  isFavorite: false,
  status: 'active' as const,
  archivedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
describe('bookmark actions', () => {
  it('requires an explicit permanent-delete confirmation and allows cancellation', () => {
    const cancel = vi.fn(),
      confirm = vi.fn();
    render(
      <DeleteBookmarkDialog
        bookmark={bookmark}
        busy={false}
        onCancel={cancel}
        onConfirm={confirm}
      />,
    );
    expect(screen.getByText(/can’t be undone/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /keep bookmark/i }));
    expect(cancel).toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });
});

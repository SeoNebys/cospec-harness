import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookmarkItem } from '../../src/components/BookmarkItem';
import { BookmarkForm } from '../../src/components/BookmarkForm';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import type { Bookmark } from '../../src/models/bookmark';

const bookmark: Bookmark = {
  id: 'b1',
  url: 'https://example.com/',
  title: 'Example',
  notes: '',
  tags: ['work'],
  dateSaved: 1,
  dateModified: 1,
};

describe('edit flow', () => {
  it('prefills the form in edit mode and submits changes (FR-007)', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => {});
    render(<BookmarkForm initial={bookmark} onSave={onSave} onCancel={() => {}} />);

    const title = screen.getByLabelText('Title') as HTMLInputElement;
    expect(title.value).toBe('Example');

    await user.clear(title);
    await user.type(title, 'Renamed');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Renamed', tags: ['work'] }),
    );
  });

  it('fires onEdit from the item action', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<BookmarkItem bookmark={bookmark} onEdit={onEdit} onDelete={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledWith(bookmark);
  });
});

describe('delete confirmation (FR-008)', () => {
  it('confirms before deleting', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog message="Delete this?" onConfirm={onConfirm} onCancel={onCancel} />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

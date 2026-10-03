import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { BookmarkQuery, TagSummary } from '../../shared/bookmark-types.js';
import { CollectionControls } from './CollectionControls.js';

const query: BookmarkQuery = { q: '', tags: [], archived: false, sort: 'newest' };
const tags: TagSummary[] = [
  { name: 'Code', bookmarkCount: 3 },
  { name: 'Reading', bookmarkCount: 2 },
];

describe('CollectionControls', () => {
  it('changes search, tags, status, and sorting through labeled controls', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CollectionControls query={query} tags={tags} onChange={onChange} onReset={vi.fn()} />);
    await user.type(screen.getByLabelText('Search bookmarks'), 'react');
    expect(onChange).toHaveBeenCalledWith({ q: 'r' });
    await user.click(screen.getByRole('button', { name: /Code/ }));
    expect(onChange).toHaveBeenCalledWith({ tags: ['Code'] });
    await user.selectOptions(screen.getByLabelText('Sort bookmarks'), 'title');
    expect(onChange).toHaveBeenCalledWith({ sort: 'title' });
  });

  it('summarizes active filters and resets them', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(
      <CollectionControls
        query={{ ...query, q: 'guide', tags: ['Code'], favorite: true }}
        tags={tags}
        onChange={vi.fn()}
        onReset={onReset}
      />,
    );
    expect(screen.getByText(/3 active filters/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(onReset).toHaveBeenCalled();
  });
});

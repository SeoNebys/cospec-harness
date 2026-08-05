import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BookmarkList } from '../../src/components/BookmarkList';
import type { Bookmark } from '../../src/models/bookmark';

function makeBookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: 'b1',
    url: 'https://example.com/',
    title: 'Example',
    notes: '',
    tags: [],
    dateSaved: 1,
    dateModified: 1,
    ...overrides,
  };
}

const noop = () => {};

describe('BookmarkList', () => {
  it('renders title and address for each bookmark (FR-005, FR-006)', () => {
    render(
      <BookmarkList
        bookmarks={[makeBookmark()]}
        hasAny
        onAdd={noop}
        onEdit={noop}
        onDelete={noop}
      />,
    );
    const link = screen.getByRole('link', { name: 'Example' });
    expect(link).toHaveAttribute('href', 'https://example.com/');
    expect(screen.getByText('https://example.com/')).toBeInTheDocument();
  });

  it('shows the empty state when nothing is saved (FR-012)', () => {
    const onAdd = vi.fn();
    render(
      <BookmarkList
        bookmarks={[]}
        hasAny={false}
        onAdd={onAdd}
        onEdit={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText(/haven’t saved any bookmarks/i)).toBeInTheDocument();
  });

  it('shows the no-results state when a filter matches nothing (FR-012)', () => {
    render(
      <BookmarkList
        bookmarks={[]}
        hasAny
        onAdd={noop}
        onEdit={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText(/no bookmarks match/i)).toBeInTheDocument();
  });
});

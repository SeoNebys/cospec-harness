import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Bookmark } from '../../shared/bookmark-types.js';
import { BookmarkList } from './BookmarkList.js';

const bookmark: Bookmark = {
  id: 1,
  title: 'Example',
  url: 'https://example.com',
  notes: 'Useful notes',
  tags: ['Research'],
  isFavorite: false,
  isArchived: false,
  createdAt: '2026-09-25T12:00:00.000Z',
  updatedAt: '2026-09-25T12:00:00.000Z',
};

describe('BookmarkList', () => {
  it('shows first-bookmark guidance for an empty collection', () => {
    render(<BookmarkList items={[]} loading={false} error={null} onRetry={vi.fn()} />);
    expect(screen.getByText('Save your first useful link')).toBeInTheDocument();
  });

  it('shows loading and retryable error states', () => {
    const { rerender } = render(<BookmarkList items={[]} loading error={null} onRetry={vi.fn()} />);
    expect(screen.getByText('Gathering your bookmarks…')).toBeInTheDocument();
    rerender(<BookmarkList items={[]} loading={false} error="Could not load" onRetry={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('renders bookmark details and a safe outbound link', () => {
    render(<BookmarkList items={[bookmark]} loading={false} error={null} onRetry={vi.fn()} />);
    const link = screen.getByRole('link', { name: 'Open Example' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('Useful notes')).toBeInTheDocument();
  });
});

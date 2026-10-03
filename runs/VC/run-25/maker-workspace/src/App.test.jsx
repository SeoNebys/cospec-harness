import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '<div id="root"></div>';
});

describe('Kept bookmark manager', () => {
  it('exposes the core controls and filters bookmarks', async () => {
    await import('./main.jsx');
    expect(await screen.findByRole('heading', { name: 'All bookmarks' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /add bookmark/i })).toHaveLength(2);
    expect(screen.getByLabelText('Search bookmarks')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search bookmarks'), { target: { value: 'Typewolf' } });
    expect(screen.getByText('Typewolf')).toBeInTheDocument();
    expect(screen.queryByText('The Marginalian')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search bookmarks'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Read later2/i }));
    expect(screen.getByRole('heading', { name: 'Read later' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Mark as read' })).toHaveLength(2);
  });
});

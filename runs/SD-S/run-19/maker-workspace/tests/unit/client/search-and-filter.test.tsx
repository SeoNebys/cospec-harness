import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SearchAndFilter } from '../../../src/client/components/SearchAndFilter.js';

describe('search and filter controls', () => {
  it('updates search and tag criteria and clears both', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    const onTagChange = vi.fn();
    const onClear = vi.fn();
    render(<SearchAndFilter
      query="design"
      selectedTag="Research"
      tags={[{ name: 'Research', count: 2 }, { name: 'Weekend', count: 1 }]}
      resultCount={1}
      onQueryChange={onQueryChange}
      onTagChange={onTagChange}
      onClear={onClear}
    />);
    await user.type(screen.getByLabelText(/search bookmarks/i), 'x');
    expect(onQueryChange).toHaveBeenLastCalledWith('designx');
    await user.selectOptions(screen.getByLabelText(/filter by tag/i), 'Weekend');
    expect(onTagChange).toHaveBeenCalledWith('Weekend');
    await user.click(screen.getByRole('button', { name: /clear search and filter/i }));
    expect(onClear).toHaveBeenCalled();
    expect(screen.getByText('1 result')).toBeInTheDocument();
  });
});

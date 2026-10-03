// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { SearchControls } from '../../src/client/features/search/SearchControls';
it('exposes search, active tag filters, help, sorting, and clear all', async () => {
  const user = userEvent.setup();
  const clear = vi.fn();
  const remove = vi.fn();
  const sort = vi.fn();
  render(
    <SearchControls
      query="design"
      tags={['Research']}
      sort="savedAt"
      direction="desc"
      onQuery={vi.fn()}
      onRemoveTag={remove}
      onSort={sort}
      onClear={clear}
    />,
  );
  await user.click(screen.getByRole('button', { name: '#Research ×' }));
  expect(remove).toHaveBeenCalledWith('Research');
  await user.selectOptions(screen.getByLabelText('Sort bookmarks'), 'title-asc');
  expect(sort).toHaveBeenCalledWith('title', 'asc');
  await user.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(clear).toHaveBeenCalled();
});

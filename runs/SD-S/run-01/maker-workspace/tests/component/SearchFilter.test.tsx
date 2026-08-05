import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from '../../src/components/SearchBar';
import { TagFilter } from '../../src/components/TagFilter';

describe('SearchBar', () => {
  it('reports typed keywords (FR-011)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} />);
    await user.type(screen.getByLabelText('Search bookmarks'), 'x');
    expect(onChange).toHaveBeenCalledWith('x');
  });
});

describe('TagFilter', () => {
  it('lists available tags and reports selection (FR-010)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagFilter tags={['dev', 'reading']} selected="" onChange={onChange} />);
    await user.selectOptions(screen.getByLabelText('Filter by tag'), 'dev');
    expect(onChange).toHaveBeenCalledWith('dev');
  });

  it('renders nothing when there are no tags', () => {
    const { container } = render(
      <TagFilter tags={[]} selected="" onChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

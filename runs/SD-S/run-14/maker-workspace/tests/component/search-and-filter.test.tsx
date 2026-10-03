import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from '../../src/app/App'
import { MemoryRepository, sample } from '../helpers'

describe('search and filter', () => {
  it('filters, announces counts, and clears a no-result query', async () => {
    const user = userEvent.setup(); render(<App repository={new MemoryRepository([sample])} />)
    await screen.findByRole('link', { name: /Example/ })
    await user.type(screen.getByRole('searchbox', { name: 'Search bookmarks' }), 'missing')
    expect(screen.getByText('No bookmarks match that')).toBeInTheDocument()
    expect(screen.getByText('Showing 0 of 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear search and filter' }))
    expect(screen.getByRole('link', { name: /Example/ })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Filter by tag'), 'Work')
    expect(screen.getByText('Showing 1 of 1')).toBeInTheDocument()
  })
})

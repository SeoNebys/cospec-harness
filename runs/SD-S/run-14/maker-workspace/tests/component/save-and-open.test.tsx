import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from '../../src/app/App'
import { MemoryRepository } from '../helpers'

describe('save and open', () => {
  it('shows empty state, validates, then saves a bookmark', async () => {
    const user = userEvent.setup(); const repository = new MemoryRepository()
    render(<App repository={repository} />)
    expect(await screen.findByText('Save your first good find')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add your first bookmark' }))
    await user.click(screen.getByRole('button', { name: 'Save bookmark' }))
    expect(await screen.findByText('Give this bookmark a title.')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Title/), 'Example')
    await user.type(screen.getByLabelText(/Web address/), 'example.com')
    await user.click(screen.getByRole('button', { name: 'Save bookmark' }))
    await waitFor(() => expect(repository.items).toHaveLength(1))
    const link = screen.getByRole('link', { name: /Example/ })
    expect(link).toHaveAttribute('target', '_blank')
  })
})

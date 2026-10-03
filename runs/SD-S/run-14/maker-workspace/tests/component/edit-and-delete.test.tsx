import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from '../../src/app/App'
import { MemoryRepository, sample } from '../helpers'

describe('edit and delete', () => {
  it('edits, cancels deletion, then deletes', async () => {
    const user = userEvent.setup(); const repository = new MemoryRepository([sample]); render(<App repository={repository} />)
    await user.click(await screen.findByRole('button', { name: 'Edit Example' }))
    const title = screen.getByLabelText(/Title/); await user.clear(title); await user.type(title, 'Updated')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('link', { name: /Updated/ })).toBeInTheDocument()
    expect(repository.items[0].createdAt).toBe(sample.createdAt)
    await user.click(screen.getByRole('button', { name: 'Delete Updated' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(repository.items).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Delete Updated' }))
    await user.click(screen.getByRole('button', { name: 'Delete bookmark' }))
    await waitFor(() => expect(repository.items).toHaveLength(0))
  })
  it('preserves the collection when a mutation fails', async () => {
    const user = userEvent.setup(); const repository = new MemoryRepository([sample]); repository.fail = true; render(<App repository={repository} />)
    await user.click(await screen.findByRole('button', { name: 'Delete Example' }))
    await user.click(screen.getByRole('button', { name: 'Delete bookmark' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('still in your collection')
    expect(screen.getByRole('link', { name: /Example/ })).toBeInTheDocument()
  })
})

import { render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'
import { App } from '../../src/app/App'
import { MemoryRepository, sample } from '../helpers'

describe('accessibility', () => {
  it('has no automatic axe violations in the populated view', async () => {
    const { container } = render(<App repository={new MemoryRepository([sample])} />)
    await screen.findByRole('link', { name: /Example/ })
    const result = await axe.run(container)
    expect(result.violations).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { comparisonKey, normalizeTags, parseTags } from '../../src/domain/tagNormalization'

describe('tag normalization', () => {
  it('removes blanks and duplicates while preserving first spelling', () => expect(normalizeTags([' Work ', '', 'work', 'Ideas'])).toEqual(['Work', 'Ideas']))
  it('normalizes compatible unicode for comparison', () => expect(comparisonKey(' ℌELLO ')).toBe('hello'))
  it('parses comma-separated entry', () => expect(parseTags('design, research, Design')).toEqual(['design', 'research']))
})

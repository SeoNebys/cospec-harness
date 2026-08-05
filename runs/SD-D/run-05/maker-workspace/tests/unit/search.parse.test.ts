import { describe, it, expect } from 'vitest'
import { parseQuery, buildMatchExpr } from '../../src/main/services/search'

// FR-020 (exact phrase in quotes) and FR-018 (keyword matching).
describe('parseQuery', () => {
  it('separates quoted phrases from bare words', () => {
    const q = parseQuery('pasta "olive oil" recipe')
    expect(q.phrases).toEqual(['olive oil'])
    expect(q.terms).toEqual(['pasta', 'recipe'])
  })

  it('handles plain words only', () => {
    expect(parseQuery('coffee beans').terms).toEqual(['coffee', 'beans'])
  })
})

describe('buildMatchExpr', () => {
  it('quotes phrases exactly and makes bare words prefix matches', () => {
    expect(buildMatchExpr(parseQuery('"olive oil" pas'))).toBe('"olive oil" "pas"*')
  })

  it('returns null when there is nothing to match', () => {
    expect(buildMatchExpr(parseQuery('   '))).toBeNull()
  })
})

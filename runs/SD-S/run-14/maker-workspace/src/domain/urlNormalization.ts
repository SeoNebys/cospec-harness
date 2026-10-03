import type { BookmarkInput } from './bookmark'
import { normalizeTags } from './tagNormalization'

export interface ValidationErrors {
  title?: string
  url?: string
}

export type ValidationResult =
  | { ok: true; value: BookmarkInput }
  | { ok: false; errors: ValidationErrors }

export function normalizeUrl(rawValue: string): string {
  const trimmed = rawValue.trim()
  if (!trimmed) throw new Error('Enter a web address.')
  const withScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  let parsed: URL
  try {
    parsed = new URL(withScheme)
  } catch {
    throw new Error('Enter a complete web address, such as example.com.')
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error('Use an HTTP or HTTPS web address.')
  }
  if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') {
    throw new Error('Enter a complete web address, such as example.com.')
  }
  return parsed.href
}

export function validateBookmarkInput(input: BookmarkInput): ValidationResult {
  const title = input.title.trim()
  const errors: ValidationErrors = {}
  if (!title) errors.title = 'Give this bookmark a title.'
  let url = ''
  try {
    url = normalizeUrl(input.url)
  } catch (error) {
    errors.url = error instanceof Error ? error.message : 'Enter a valid web address.'
  }
  if (Object.keys(errors).length) return { ok: false, errors }
  return {
    ok: true,
    value: {
      title,
      url,
      description: input.description.trim(),
      tags: normalizeTags(input.tags),
    },
  }
}

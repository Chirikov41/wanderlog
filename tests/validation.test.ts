import { describe, expect, it } from 'vitest'
import { emptyDraft, entryToDraft } from '../src/lib/draft'
import { NOTES_MAX, hasErrors, validateEntryDraft } from '../src/lib/validation'
import type { Entry } from '../src/types'

describe('validateEntryDraft', () => {
  it('requires a title', () => {
    const errors = validateEntryDraft(emptyDraft())
    expect(errors.title).toBeDefined()
    expect(errors.place).toBeDefined()
  })

  it('requires a title of at least two characters', () => {
    const draft = { ...emptyDraft(), title: 'a', place: { name: 'Skye' } }
    expect(validateEntryDraft(draft).title).toMatch(/2 characters/)
  })

  it('accepts a place name without coordinates', () => {
    const draft = { ...emptyDraft(), title: 'Oban harbour', place: { name: 'Oban' } }
    expect(validateEntryDraft(draft)).toEqual({})
  })

  it('accepts coordinates without a place name', () => {
    const draft = {
      ...emptyDraft(),
      title: 'Somewhere',
      coords: { lat: 56.4, lng: -5.4 },
    }
    expect(validateEntryDraft(draft)).toEqual({})
  })

  it('rejects over-long notes', () => {
    const draft = {
      ...emptyDraft(),
      title: 'Long one',
      place: { name: 'Skye' },
      notes: 'x'.repeat(NOTES_MAX + 1),
    }
    expect(validateEntryDraft(draft).notes).toMatch(/limited/)
  })

  it('rejects an out-of-range rating', () => {
    const draft = { ...emptyDraft(), title: 'Rated', place: { name: 'Skye' }, rating: 9 }
    expect(validateEntryDraft(draft).rating).toMatch(/between 0 and 5/)
  })

  it('trims nothing but reports no error for padded titles', () => {
    const draft = { ...emptyDraft(), title: '  Skye  ', place: { name: 'Skye' } }
    expect(hasErrors(validateEntryDraft(draft))).toBe(false)
  })
})

describe('draft helpers', () => {
  it('creates an empty draft with a default category and no photo', () => {
    const draft = emptyDraft()
    expect(draft.title).toBe('')
    expect(draft.category).toBe('coast')
    expect(draft.photo).toBeNull()
    expect(draft.coords).toBeNull()
  })

  it('converts an entry back into an editable draft', () => {
    const now = Date.now()
    const entry: Entry = {
      id: 'abc',
      title: 'Quiraing',
      notes: 'Mist',
      category: 'mountain',
      rating: 5,
      visitedAt: now,
      createdAt: now,
      updatedAt: now,
      place: { name: 'Quiraing' },
      coords: { lat: 57.6, lng: -6.2 },
      photo: null,
    }
    const draft = entryToDraft(entry)
    expect(draft).not.toHaveProperty('id')
    expect(draft.title).toBe('Quiraing')
    expect(draft.coords).toEqual({ lat: 57.6, lng: -6.2 })
  })
})

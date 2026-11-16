import type { EntryDraft } from '../types'

export type EntryField = 'title' | 'place' | 'notes' | 'rating'
export type EntryErrors = Partial<Record<EntryField, string>>

export const TITLE_MAX = 80
export const NOTES_MAX = 1200

/**
 * Client-side validation for the capture/edit form.
 *
 * A memory needs either a coordinate pair or a typed place name — the app is
 * designed to keep working when location permission is denied, so we do not
 * force the API to be available.
 */
export function validateEntryDraft(draft: EntryDraft): EntryErrors {
  const errors: EntryErrors = {}
  const title = draft.title.trim()

  if (!title) {
    errors.title = 'Give this memory a title.'
  } else if (title.length < 2) {
    errors.title = 'Use at least 2 characters.'
  } else if (title.length > TITLE_MAX) {
    errors.title = `Keep the title under ${TITLE_MAX} characters.`
  }

  if (!draft.place.name.trim() && !draft.coords) {
    errors.place = 'Add a place name or pin your location.'
  }

  if (draft.notes.length > NOTES_MAX) {
    errors.notes = `Notes are limited to ${NOTES_MAX} characters.`
  }

  if (!Number.isInteger(draft.rating) || draft.rating < 0 || draft.rating > 5) {
    errors.rating = 'Rating must be between 0 and 5.'
  }

  return errors
}

export function hasErrors(errors: EntryErrors): boolean {
  return Object.keys(errors).length > 0
}

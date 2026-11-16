import type { Entry, EntryDraft } from '../types'

export function emptyDraft(): EntryDraft {
  return {
    title: '',
    notes: '',
    category: 'coast',
    rating: 0,
    visitedAt: Date.now(),
    place: { name: '', region: '', country: '' },
    coords: null,
    photo: null,
  }
}

export function entryToDraft(entry: Entry): EntryDraft {
  return {
    title: entry.title,
    notes: entry.notes,
    category: entry.category,
    rating: entry.rating,
    visitedAt: entry.visitedAt,
    place: entry.place,
    coords: entry.coords,
    photo: entry.photo,
  }
}

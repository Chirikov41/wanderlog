import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { newId } from './id'
import type { Entry, EntryDraft } from '../types'

/** Create — stamps a fresh id and the audit timestamps. */
export async function createEntry(draft: EntryDraft): Promise<Entry> {
  const now = Date.now()
  const entry: Entry = { ...draft, id: newId(), createdAt: now, updatedAt: now }
  await db.entries.add(entry)
  return entry
}

/** Update — keeps `createdAt` intact and refreshes `updatedAt`. */
export async function updateEntry(id: string, draft: EntryDraft): Promise<void> {
  await db.entries.update(id, { ...draft, updatedAt: Date.now() })
}

/** Delete — the row (and therefore the photo blobs) is removed in one go. */
export async function deleteEntry(id: string): Promise<void> {
  await db.entries.delete(id)
}

export async function getEntry(id: string): Promise<Entry | undefined> {
  return db.entries.get(id)
}

export async function listEntries(): Promise<Entry[]> {
  return db.entries.orderBy('visitedAt').reverse().toArray()
}

export async function countEntries(): Promise<number> {
  return db.entries.count()
}

/**
 * Reactive read. `useLiveQuery` re-runs the query whenever IndexedDB changes,
 * so every screen updates itself after a create/update/delete without any
 * manual cache invalidation or global event bus.
 *
 * `undefined` means the first query has not resolved yet; screens use that to
 * show skeletons instead of a flash of "empty journal".
 */
export function useEntries(): Entry[] | undefined {
  return useLiveQuery(() => db.entries.orderBy('visitedAt').reverse().toArray(), [])
}

/** Single entry. `undefined` = still loading, `null` = not found. */
export function useEntry(id: string | undefined): Entry | null | undefined {
  return useLiveQuery(
    async () => {
      if (!id) return null
      return (await db.entries.get(id)) ?? null
    },
    [id],
    undefined,
  )
}

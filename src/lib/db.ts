import Dexie, { type Table } from 'dexie'
import type { Entry, PlaceCacheRecord } from '../types'

/**
 * Wanderlog keeps everything on the device, in IndexedDB.
 *
 * Two object stores:
 *  - `entries` — one row per memory, indexed by the fields we sort and filter on
 *    (`visitedAt` for the journal order, `createdAt` for exports, `category` for
 *    the filter chips).
 *  - `places` — a small cache of reverse-geocoding answers so a place name is
 *    never requested twice and still resolves when the device is offline.
 *
 * Photos live inside the entry row as `Blob`s. IndexedDB stores blobs natively,
 * which means no base64 inflation and no quota problems from localStorage.
 */
export class WanderlogDatabase extends Dexie {
  entries!: Table<Entry, string>
  places!: Table<PlaceCacheRecord, string>

  constructor() {
    super('wanderlog')
    this.version(1).stores({
      entries: 'id, visitedAt, createdAt, category',
      places: 'key, fetchedAt',
    })
  }
}

export const db = new WanderlogDatabase()

/** Wipes every store — used by "Delete all memories" in Settings. */
export async function clearDatabase(): Promise<void> {
  await db.transaction('rw', db.entries, db.places, async () => {
    await db.entries.clear()
    await db.places.clear()
  })
}

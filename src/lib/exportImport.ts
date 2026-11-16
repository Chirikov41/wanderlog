import { blobToDataUrl, createPhotoRecord, dataUrlToBlob } from './image'
import { db } from './db'
import { newId } from './id'
import type { CategoryId, Coordinates, Entry, PhotoRecord, PlaceInfo } from '../types'

/**
 * JSON backup / restore.
 *
 * Photos are embedded as data URLs so a single file contains the complete
 * journal. On import the thumbnails are regenerated rather than stored twice,
 * which keeps the file smaller and guarantees the thumbnail pipeline keeps
 * working if its settings ever change.
 */

export interface BackupPhoto {
  dataUrl: string
  mime: string
  width: number
  height: number
  source: PhotoRecord['source']
  capturedAt: number
}

export interface BackupEntry {
  id: string
  title: string
  notes: string
  category: CategoryId
  rating: number
  visitedAt: number
  createdAt: number
  updatedAt: number
  place: PlaceInfo
  coords: Coordinates | null
  photo: BackupPhoto | null
}

export interface BackupFile {
  app: 'wanderlog'
  version: 1
  exportedAt: string
  entries: BackupEntry[]
}

export async function buildBackup(): Promise<BackupFile> {
  const entries = await db.entries.toArray()
  const serialised: BackupEntry[] = []

  for (const entry of entries) {
    serialised.push({
      id: entry.id,
      title: entry.title,
      notes: entry.notes,
      category: entry.category,
      rating: entry.rating,
      visitedAt: entry.visitedAt,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      place: entry.place,
      coords: entry.coords,
      photo: entry.photo
        ? {
            dataUrl: await blobToDataUrl(entry.photo.blob),
            mime: entry.photo.blob.type || 'image/jpeg',
            width: entry.photo.width,
            height: entry.photo.height,
            source: entry.photo.source,
            capturedAt: entry.photo.capturedAt,
          }
        : null,
    })
  }

  return {
    app: 'wanderlog',
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: serialised,
  }
}

export function isWanderlogBackup(value: unknown): value is BackupFile {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<BackupFile>
  return candidate.app === 'wanderlog' && Array.isArray(candidate.entries)
}

/** Triggers a download of the whole journal and returns the entry count. */
export async function downloadBackup(): Promise<number> {
  const backup = await buildBackup()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  anchor.href = url
  anchor.download = `wanderlog-backup-${stamp}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
  return backup.entries.length
}

async function reviveEntry(raw: BackupEntry): Promise<Entry | null> {
  if (typeof raw !== 'object' || raw === null) return null
  if (typeof raw.title !== 'string' || typeof raw.visitedAt !== 'number') return null

  let photo: PhotoRecord | null = null
  if (raw.photo?.dataUrl) {
    const blob = await dataUrlToBlob(raw.photo.dataUrl)
    photo = await createPhotoRecord(blob, raw.photo.source ?? 'library')
  }

  const now = Date.now()
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
    title: raw.title,
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    category: raw.category ?? 'other',
    rating: typeof raw.rating === 'number' ? raw.rating : 0,
    visitedAt: raw.visitedAt,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    updatedAt: now,
    place: {
      name: raw.place?.name ?? '',
      region: raw.place?.region ?? '',
      country: raw.place?.country ?? '',
    },
    coords: raw.coords ?? null,
    photo,
  }
}

export async function importBackupFile(file: File): Promise<{ imported: number; skipped: number }> {
  const text = await file.text()
  const parsed: unknown = JSON.parse(text)
  if (!isWanderlogBackup(parsed)) {
    throw new Error('That file is not a Wanderlog backup.')
  }

  let imported = 0
  let skipped = 0

  for (const raw of parsed.entries) {
    try {
      const entry = await reviveEntry(raw)
      if (!entry) {
        skipped += 1
        continue
      }
      await db.entries.put(entry)
      imported += 1
    } catch {
      skipped += 1
    }
  }

  return { imported, skipped }
}

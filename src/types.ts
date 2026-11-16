/**
 * Domain types shared by the data layer, the hooks and the UI.
 */

export type CategoryId =
  | 'coast'
  | 'mountain'
  | 'city'
  | 'food'
  | 'culture'
  | 'wildlife'
  | 'other'

export interface LatLng {
  lat: number
  lng: number
}

export interface PlaceInfo {
  name: string
  region?: string
  country?: string
}

export interface Coordinates extends LatLng {
  /** Horizontal accuracy reported by the Geolocation API, in metres. */
  accuracy?: number | null
  altitude?: number | null
  /** Compass heading at the moment of capture, in degrees (0 = north). */
  heading?: number | null
}

export interface PhotoRecord {
  id: string
  /** Full-size, compressed JPEG. */
  blob: Blob
  /** Small copy used by lists so scrolling stays smooth. */
  thumb: Blob
  width: number
  height: number
  bytes: number
  source: 'camera' | 'library'
  capturedAt: number
}

export interface Entry {
  id: string
  title: string
  notes: string
  category: CategoryId
  /** 0 means "not rated", otherwise 1–5. */
  rating: number
  /** When the place was visited (used for ordering). */
  visitedAt: number
  createdAt: number
  updatedAt: number
  place: PlaceInfo
  coords: Coordinates | null
  photo: PhotoRecord | null
}

/** Everything the form collects; the repository stamps id/timestamps. */
export type EntryDraft = Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>

export interface PlaceCacheRecord {
  key: string
  place: PlaceInfo
  fetchedAt: number
}

export interface JournalSummary {
  entries: number
  places: number
  photos: number
  distanceKm: number
  countries: string[]
  regions: string[]
  categories: Record<CategoryId, number>
  averageRating: number
  firstVisit: number | null
  lastVisit: number | null
}

export interface MonthBucket {
  key: string
  label: string
  count: number
}

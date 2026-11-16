import { db } from './db'
import type { PlaceInfo } from '../types'

/**
 * Reverse geocoding through Nominatim (OpenStreetMap).
 *
 * Three rules keep this polite and reliable:
 *  1. Ask at most once per second, as the Nominatim usage policy requires.
 *  2. Cache every answer in IndexedDB, keyed by a rounded coordinate, so the
 *     same spot is never requested twice.
 *  3. Never block the form — on failure the user simply types the place name.
 */

const ENDPOINT = 'https://nominatim.openstreetmap.org/reverse'
const MIN_INTERVAL_MS = 1100

interface NominatimResponse {
  name?: string
  display_name?: string
  address?: Record<string, string | undefined>
}

let lastRequestAt = 0
const inflight = new Map<string, Promise<PlaceInfo | null>>()

/** ~110 m of precision is plenty for a place-name lookup and improves the cache hit rate. */
export function placeCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function pickName(response: NominatimResponse): string {
  const address = response.address ?? {}
  const candidates = [
    response.name,
    address.tourism,
    address.attraction,
    address.hamlet,
    address.village,
    address.suburb,
    address.town,
    address.city,
    address.county,
  ]
  for (const candidate of candidates) {
    const value = candidate?.trim()
    if (value) return value
  }
  const firstLine = response.display_name?.split(',')[0]?.trim()
  return firstLine ?? ''
}

function toPlaceInfo(response: NominatimResponse): PlaceInfo | null {
  const name = pickName(response)
  if (!name) return null
  const address = response.address ?? {}
  return {
    name,
    region: (address.state ?? address.region ?? address.county)?.trim() ?? '',
    country: address.country?.trim() ?? '',
  }
}

async function requestPlace(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<PlaceInfo | null> {
  const gap = Date.now() - lastRequestAt
  if (gap < MIN_INTERVAL_MS) await wait(MIN_INTERVAL_MS - gap)
  lastRequestAt = Date.now()

  const url = `${ENDPOINT}?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1&accept-language=en`

  try {
    const response = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return null
    const payload = (await response.json()) as NominatimResponse
    const place = toPlaceInfo(payload)
    if (!place) return null
    await db.places.put({ key: placeCacheKey(lat, lng), place, fetchedAt: Date.now() })
    return place
  } catch {
    return null
  }
}

/**
 * Resolves coordinates to a place name. Returns `null` when the network is
 * unavailable or the service has no answer — callers treat that as "unknown".
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<PlaceInfo | null> {
  const key = placeCacheKey(lat, lng)

  try {
    const cached = await db.places.get(key)
    if (cached) return cached.place
  } catch {
    // If IndexedDB is unavailable we still try the network.
  }

  const existing = inflight.get(key)
  if (existing) return existing

  const task = requestPlace(lat, lng, signal).finally(() => {
    inflight.delete(key)
  })
  inflight.set(key, task)
  return task
}

/** Builds a "Somewhere near 55.95, -3.19" label for entries without a name. */
export function describeCoordinates(lat: number, lng: number): string {
  return `Near ${lat.toFixed(2)}, ${lng.toFixed(2)}`
}

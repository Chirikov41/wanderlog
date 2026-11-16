import type { LatLng } from '../types'

/** Mean Earth radius in kilometres (IUGG). */
const EARTH_RADIUS_KM = 6371.0088
const DEG_TO_RAD = Math.PI / 180

export function toRadians(degrees: number): number {
  return degrees * DEG_TO_RAD
}

/**
 * Great-circle distance between two points, in kilometres.
 *
 * Wanderlog records a "distance travelled" figure in Stats. It is the sum of
 * straight-line hops between consecutive memories rather than a road route,
 * which is why the UI labels it "as the crow flies".
 */
export function haversineKm(from: LatLng, to: LatLng): number {
  const dLat = toRadians(to.lat - from.lat)
  const dLng = toRadians(to.lng - from.lng)
  const lat1 = toRadians(from.lat)
  const lat2 = toRadians(to.lat)

  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function totalDistanceKm(points: LatLng[]): number {
  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    total += haversineKm(points[i - 1], points[i])
  }
  return total
}

/** Initial bearing from `from` to `to`, normalised to 0–360 degrees. */
export function bearingDegrees(from: LatLng, to: LatLng): number {
  const lat1 = toRadians(from.lat)
  const lat2 = toRadians(to.lat)
  const dLng = toRadians(to.lng - from.lng)
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360
}

const COMPASS_POINTS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const

/** Converts any heading into a 16-point compass label. */
export function compassPoint(degrees: number): string {
  const normalised = ((degrees % 360) + 360) % 360
  const index = Math.round(normalised / 22.5) % COMPASS_POINTS.length
  return COMPASS_POINTS[index]
}

/**
 * Human-friendly distance. Metres for short hops, kilometres beyond that, and
 * a compact "k" form once the number gets long.
 */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '—'
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  if (km < 1000) return `${Math.round(km)} km`
  return `${(km / 1000).toFixed(1)}k km`
}

/** 55.9533° N, 3.1883° W */
export function formatCoordinates(point: LatLng, decimals = 4): string {
  const lat = `${Math.abs(point.lat).toFixed(decimals)}° ${point.lat >= 0 ? 'N' : 'S'}`
  const lng = `${Math.abs(point.lng).toFixed(decimals)}° ${point.lng >= 0 ? 'E' : 'W'}`
  return `${lat}, ${lng}`
}

export type AccuracyBand = 'high' | 'medium' | 'low' | 'unknown'

/** Groups a Geolocation accuracy figure so the UI can colour-code it. */
export function accuracyBand(metres: number | null | undefined): AccuracyBand {
  if (typeof metres !== 'number' || !Number.isFinite(metres)) return 'unknown'
  if (metres <= 30) return 'high'
  if (metres <= 150) return 'medium'
  return 'low'
}

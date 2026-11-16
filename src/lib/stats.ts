import { CATEGORIES } from './categories'
import { totalDistanceKm } from './geo'
import type { CategoryId, Entry, JournalSummary, LatLng, MonthBucket } from '../types'

const EMPTY_CATEGORIES: Record<CategoryId, number> = {
  coast: 0,
  mountain: 0,
  city: 0,
  food: 0,
  culture: 0,
  wildlife: 0,
  other: 0,
}

/**
 * Derives every headline number shown on the Stats screen and the Journal
 * header. Kept pure so it is cheap to memoise and easy to test.
 */
export function summarise(entries: Entry[]): JournalSummary {
  const sorted = [...entries].sort((a, b) => a.visitedAt - b.visitedAt)
  const categories: Record<CategoryId, number> = { ...EMPTY_CATEGORIES }
  const countries = new Set<string>()
  const regions = new Set<string>()
  let photos = 0
  let ratingTotal = 0
  let ratingCount = 0

  const route: LatLng[] = []

  for (const entry of sorted) {
    categories[entry.category] += 1
    if (entry.photo) photos += 1
    if (entry.rating > 0) {
      ratingTotal += entry.rating
      ratingCount += 1
    }
    const country = entry.place.country?.trim()
    if (country) countries.add(country)
    const region = entry.place.region?.trim()
    if (region) regions.add(region)
    if (entry.coords) route.push({ lat: entry.coords.lat, lng: entry.coords.lng })
  }

  return {
    entries: entries.length,
    places: regions.size + countries.size,
    photos,
    distanceKm: totalDistanceKm(route),
    countries: [...countries].sort(),
    regions: [...regions].sort(),
    categories,
    averageRating: ratingCount === 0 ? 0 : ratingTotal / ratingCount,
    firstVisit: sorted.length > 0 ? sorted[0].visitedAt : null,
    lastVisit: sorted.length > 0 ? sorted[sorted.length - 1].visitedAt : null,
  }
}

/**
 * Buckets entries into the last `months` calendar months (oldest first) so the
 * Stats screen can draw a simple activity column chart.
 */
export function monthlyActivity(
  entries: Entry[],
  months = 6,
  now: number = Date.now(),
): MonthBucket[] {
  const reference = new Date(now)
  const buckets: MonthBucket[] = []

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(reference.getFullYear(), reference.getMonth() - offset, 1)
    buckets.push({
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(date),
      count: 0,
    })
  }

  const index = new Map(buckets.map((bucket, position) => [bucket.key, position]))
  for (const entry of entries) {
    const date = new Date(entry.visitedAt)
    const key = `${date.getFullYear()}-${date.getMonth()}`
    const position = index.get(key)
    if (position !== undefined) buckets[position].count += 1
  }

  return buckets
}

/** Most-used categories, highest first — powers the Stats bars. */
export function categoryBreakdown(entries: Entry[]): { id: CategoryId; label: string; colour: string; count: number }[] {
  const counts = summarise(entries).categories
  return CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    colour: category.colour,
    count: counts[category.id],
  }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)
}

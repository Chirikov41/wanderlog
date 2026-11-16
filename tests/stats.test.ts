import { describe, expect, it } from 'vitest'
import { categoryBreakdown, monthlyActivity, summarise } from '../src/lib/stats'
import type { CategoryId, Entry } from '../src/types'

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  const now = new Date(2026, 4, 18, 12).getTime()
  return {
    id: Math.random().toString(36).slice(2),
    title: 'A place',
    notes: '',
    category: 'mountain',
    rating: 4,
    visitedAt: now,
    createdAt: now,
    updatedAt: now,
    place: { name: 'Quiraing', region: 'Highland', country: 'Scotland' },
    coords: { lat: 57.6416, lng: -6.2654, accuracy: 8 },
    photo: null,
    ...overrides,
  }
}

const entries: Entry[] = [
  makeEntry({ rating: 5, category: 'mountain' as CategoryId }),
  makeEntry({
    rating: 0,
    category: 'coast',
    visitedAt: new Date(2026, 5, 14).getTime(),
    coords: { lat: 55.954, lng: -3.114 },
  }),
  makeEntry({
    rating: 3,
    category: 'city',
    place: { name: 'Royal Mile', region: 'Edinburgh', country: 'Scotland' },
    visitedAt: new Date(2026, 6, 2).getTime(),
    coords: null,
  }),
]

describe('summarise', () => {
  const summary = summarise(entries)

  it('counts entries, photos and categories', () => {
    expect(summary.entries).toBe(3)
    expect(summary.photos).toBe(0)
    expect(summary.categories.mountain).toBe(1)
    expect(summary.categories.coast).toBe(1)
    expect(summary.categories.city).toBe(1)
    expect(summary.categories.food).toBe(0)
  })

  it('averages only rated entries', () => {
    expect(summary.averageRating).toBeCloseTo(4, 6)
  })

  it('collects unique regions and countries', () => {
    expect(summary.regions).toEqual(['Edinburgh', 'Highland'])
    expect(summary.countries).toEqual(['Scotland'])
  })

  it('measures distance between entries that have coordinates', () => {
    expect(summary.distanceKm).toBeGreaterThan(100)
    expect(summary.distanceKm).toBeLessThan(400)
  })

  it('handles an empty journal', () => {
    const empty = summarise([])
    expect(empty.entries).toBe(0)
    expect(empty.distanceKm).toBe(0)
    expect(empty.averageRating).toBe(0)
    expect(empty.firstVisit).toBeNull()
  })
})

describe('monthlyActivity', () => {
  it('returns the requested number of buckets oldest first', () => {
    const buckets = monthlyActivity(entries, 6, new Date(2026, 9, 15).getTime())
    expect(buckets).toHaveLength(6)
    expect(buckets[0].label).toBe('May')
    expect(buckets[5].label).toBe('Oct')
  })

  it('counts entries in the right month', () => {
    const buckets = monthlyActivity(entries, 6, new Date(2026, 9, 15).getTime())
    const may = buckets.find((bucket) => bucket.label === 'May')
    const jun = buckets.find((bucket) => bucket.label === 'Jun')
    expect(may?.count).toBe(1)
    expect(jun?.count).toBe(1)
  })
})

describe('categoryBreakdown', () => {
  it('orders used categories by count and drops empty ones', () => {
    const breakdown = categoryBreakdown(entries)
    expect(breakdown).toHaveLength(3)
    expect(breakdown.every((row) => row.count === 1)).toBe(true)
  })
})

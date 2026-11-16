import { describe, expect, it } from 'vitest'
import {
  accuracyBand,
  bearingDegrees,
  compassPoint,
  formatCoordinates,
  formatDistance,
  haversineKm,
  totalDistanceKm,
} from '../src/lib/geo'

const EDINBURGH = { lat: 55.9533, lng: -3.1883 }
const GLASGOW = { lat: 55.8642, lng: -4.2518 }
const LONDON = { lat: 51.5072, lng: -0.1276 }

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(EDINBURGH, EDINBURGH)).toBeCloseTo(0, 6)
  })

  it('measures Edinburgh to Glasgow at roughly 67 km', () => {
    const distance = haversineKm(EDINBURGH, GLASGOW)
    expect(distance).toBeGreaterThan(65)
    expect(distance).toBeLessThan(69)
  })

  it('measures Edinburgh to London at roughly 534 km', () => {
    const distance = haversineKm(EDINBURGH, LONDON)
    expect(distance).toBeGreaterThan(525)
    expect(distance).toBeLessThan(545)
  })

  it('is symmetric', () => {
    expect(haversineKm(EDINBURGH, GLASGOW)).toBeCloseTo(haversineKm(GLASGOW, EDINBURGH), 9)
  })
})

describe('totalDistanceKm', () => {
  it('is zero for fewer than two points', () => {
    expect(totalDistanceKm([])).toBe(0)
    expect(totalDistanceKm([EDINBURGH])).toBe(0)
  })

  it('sums consecutive hops', () => {
    const total = totalDistanceKm([EDINBURGH, GLASGOW, LONDON])
    expect(total).toBeCloseTo(haversineKm(EDINBURGH, GLASGOW) + haversineKm(GLASGOW, LONDON), 6)
  })
})

describe('bearingDegrees', () => {
  it('points north when moving straight up the meridian', () => {
    expect(bearingDegrees({ lat: 0, lng: 0 }, { lat: 10, lng: 0 })).toBeCloseTo(0, 5)
  })

  it('points east when moving along the equator', () => {
    expect(bearingDegrees({ lat: 0, lng: 0 }, { lat: 0, lng: 10 })).toBeCloseTo(90, 5)
  })

  it('stays inside 0–360', () => {
    const bearing = bearingDegrees(EDINBURGH, GLASGOW)
    expect(bearing).toBeGreaterThanOrEqual(0)
    expect(bearing).toBeLessThan(360)
    expect(bearing).toBeGreaterThan(240)
    expect(bearing).toBeLessThan(280)
  })
})

describe('compassPoint', () => {
  it.each([
    [0, 'N'],
    [90, 'E'],
    [180, 'S'],
    [270, 'W'],
    [350, 'N'],
    [45, 'NE'],
    [-90, 'W'],
  ])('maps %i degrees to %s', (degrees, expected) => {
    expect(compassPoint(degrees)).toBe(expected)
  })
})

describe('formatDistance', () => {
  it('uses metres below one kilometre', () => {
    expect(formatDistance(0.42)).toBe('420 m')
  })

  it('keeps one decimal for short distances', () => {
    expect(formatDistance(1.26)).toBe('1.3 km')
  })

  it('rounds longer distances', () => {
    expect(formatDistance(549.4)).toBe('549 km')
  })

  it('compacts thousands', () => {
    expect(formatDistance(1240)).toBe('1.2k km')
  })

  it('handles invalid input', () => {
    expect(formatDistance(Number.NaN)).toBe('—')
    expect(formatDistance(-2)).toBe('—')
  })
})

describe('formatCoordinates', () => {
  it('uses hemisphere letters', () => {
    expect(formatCoordinates(EDINBURGH)).toBe('55.9533° N, 3.1883° W')
    expect(formatCoordinates({ lat: -33.8688, lng: 151.2093 })).toBe('33.8688° S, 151.2093° E')
  })
})

describe('accuracyBand', () => {
  it('classifies GPS accuracy', () => {
    expect(accuracyBand(8)).toBe('high')
    expect(accuracyBand(80)).toBe('medium')
    expect(accuracyBand(400)).toBe('low')
    expect(accuracyBand(null)).toBe('unknown')
  })
})

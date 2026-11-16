import { describe, expect, it } from 'vitest'
import {
  escapeHtml,
  formatBytes,
  formatCount,
  formatDate,
  formatLongDate,
  formatRelative,
  fromDateInputValue,
  greeting,
  toDateInputValue,
  truncate,
} from '../src/lib/format'

const JUNE_14_2026 = new Date(2026, 5, 14, 15, 30).getTime()

describe('formatDate', () => {
  it('formats in British English', () => {
    expect(formatDate(JUNE_14_2026)).toBe('14 Jun 2026')
    expect(formatLongDate(JUNE_14_2026)).toBe('Sunday, 14 June 2026')
  })
})

describe('formatRelative', () => {
  const now = new Date(2026, 5, 14, 12, 0).getTime()

  it('reports very recent timestamps as just now', () => {
    expect(formatRelative(now - 10_000, now)).toBe('just now')
  })

  it('reports minutes, hours and days', () => {
    expect(formatRelative(now - 12 * 60_000, now)).toBe('12 min ago')
    expect(formatRelative(now - 3 * 3_600_000, now)).toBe('3 h ago')
    expect(formatRelative(now - 5 * 86_400_000, now)).toBe('5 d ago')
  })

  it('falls back to an absolute date after a week', () => {
    expect(formatRelative(now - 40 * 86_400_000, now)).toBe('5 May 2026')
  })
})

describe('formatBytes', () => {
  it('scales units', () => {
    expect(formatBytes(900)).toBe('900 bytes')
    expect(formatBytes(2048)).toBe('2.0 kB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })

  it('guards invalid input', () => {
    expect(formatBytes(-1)).toBe('—')
  })
})

describe('formatCount', () => {
  it('uses the singular for one', () => {
    expect(formatCount(1, 'memory', 'memories')).toBe('1 memory')
    expect(formatCount(3, 'memory', 'memories')).toBe('3 memories')
    expect(formatCount(2, 'pin')).toBe('2 pins')
  })
})

describe('truncate', () => {
  it('trims long text and adds an ellipsis', () => {
    expect(truncate('  hello world  ', 20)).toBe('hello world')
    expect(truncate('abcdefghij', 5)).toBe('abcd…')
  })
})

describe('date input helpers', () => {
  it('round-trips a local date', () => {
    const value = toDateInputValue(JUNE_14_2026)
    expect(value).toBe('2026-06-14')
    const parsed = fromDateInputValue(value)
    expect(parsed).not.toBeNull()
    expect(toDateInputValue(parsed as number)).toBe('2026-06-14')
  })

  it('rejects malformed or impossible dates', () => {
    expect(fromDateInputValue('14/06/2026')).toBeNull()
    expect(fromDateInputValue('2026-02-31')).toBeNull()
  })
})

describe('greeting', () => {
  it.each([
    [3, 'Still awake'],
    [9, 'Good morning'],
    [14, 'Good afternoon'],
    [20, 'Good evening'],
  ])('greets at %i:00 as %s', (hour, expected) => {
    expect(greeting(new Date(2026, 5, 14, hour))).toBe(expected)
  })
})

describe('escapeHtml', () => {
  it('escapes the characters used in marker markup', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
    )
  })
})

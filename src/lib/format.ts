/**
 * Small formatting helpers. All of them are pure so they can be unit tested
 * without a DOM (see tests/format.test.ts).
 */

const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-GB', { month: 'short' })

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** 14 Jun 2026 */
export function formatDate(timestamp: number): string {
  return DATE_FORMATTER.format(new Date(timestamp))
}

/** Sunday, 14 June 2026 */
export function formatLongDate(timestamp: number): string {
  return LONG_DATE_FORMATTER.format(new Date(timestamp))
}

/** Jun */
export function formatMonth(timestamp: number): string {
  return MONTH_FORMATTER.format(new Date(timestamp))
}

/** "just now", "12 min ago", "3 h ago", "5 d ago", or an absolute date. */
export function formatRelative(timestamp: number, now: number = Date.now()): string {
  const diff = now - timestamp
  if (!Number.isFinite(diff)) return '—'
  if (diff < MINUTE) return 'just now'
  if (diff < HOUR) return `${Math.round(diff / MINUTE)} min ago`
  if (diff < DAY) return `${Math.round(diff / HOUR)} h ago`
  if (diff < 7 * DAY) return `${Math.round(diff / DAY)} d ago`
  return formatDate(timestamp)
}

/** 1.4 MB / 812 kB / 97 bytes */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} bytes`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} kB`
  const mb = kb / 1024
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
}

/** 1 memory / 3 memories */
export function formatCount(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`
}

export function truncate(text: string, maxLength: number): string {
  const clean = text.trim()
  if (clean.length <= maxLength) return clean
  return `${clean.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

/** Local-time yyyy-mm-dd for <input type="date">. */
export function toDateInputValue(timestamp: number): string {
  const date = new Date(timestamp)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Parses yyyy-mm-dd at local noon so time zones cannot shift the date. */
export function fromDateInputValue(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day, 12, 0, 0, 0)
  if (Number.isNaN(date.getTime())) return null
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date.getTime()
}

export function greeting(date: Date = new Date()): string {
  const hour = date.getHours()
  if (hour < 5) return 'Still awake'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** Used when building Leaflet divIcon markup from user-entered text. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

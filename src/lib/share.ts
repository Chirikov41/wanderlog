import { formatDate } from './format'
import type { Entry } from '../types'

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'unsupported'

function buildText(entry: Entry): string {
  const place = entry.place.name || 'Somewhere'
  const lines = [`${entry.title} — ${place}`, `Visited ${formatDate(entry.visitedAt)}`]
  if (entry.coords) {
    lines.push(
      `https://www.openstreetmap.org/?mlat=${entry.coords.lat.toFixed(5)}&mlon=${entry.coords.lng.toFixed(5)}#map=13/${entry.coords.lat.toFixed(5)}/${entry.coords.lng.toFixed(5)}`,
    )
  }
  return lines.join('\n')
}

/**
 * Uses the Web Share API where it exists (Android Chrome, iOS Safari), sharing
 * the photo as a real file when the browser supports file sharing. On desktop
 * browsers the text is copied to the clipboard instead.
 */
export async function shareEntry(entry: Entry): Promise<ShareResult> {
  const text = buildText(entry)
  const navigatorWithShare = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean
  }

  if (typeof navigator.share === 'function') {
    const data: ShareData = { title: entry.title, text }
    if (entry.photo) {
      const file = new File([entry.photo.blob], `wanderlog-${entry.id.slice(0, 8)}.jpg`, {
        type: 'image/jpeg',
      })
      if (navigatorWithShare.canShare?.({ files: [file] })) {
        data.files = [file]
      }
    }

    try {
      await navigator.share(data)
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // Any other failure falls back to the clipboard below.
    }
  }

  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'unsupported'
  }
}

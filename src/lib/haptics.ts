/**
 * Haptic feedback through the Vibration API.
 *
 * This is a progressive enhancement: iOS Safari ignores it, and every call
 * site works the same with or without support.
 */
export function tap(pattern: number | number[] = 12): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(pattern)
  } catch {
    // Some browsers throw when the page is not visible — safe to ignore.
  }
}

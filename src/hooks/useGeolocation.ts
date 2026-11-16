import { useCallback, useEffect, useRef, useState } from 'react'
import type { Coordinates } from '../types'

export type GeolocationStatus = 'idle' | 'locating' | 'ready' | 'error' | 'unsupported'

export interface GeolocationSnapshot {
  status: GeolocationStatus
  coords: Coordinates | null
  error: string | null
  updatedAt: number | null
}

const ERROR_MESSAGES: Record<number, string> = {
  1: 'Location permission was denied. Allow it in your browser settings, or type the place name yourself.',
  2: 'Your device could not work out where it is. Step outside and try again.',
  3: 'The location request timed out. Give it another go in a moment.',
}

const OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 5_000,
}

/**
 * Wraps the Geolocation API with the extra states a real UI needs
 * (idle / locating / ready / error / unsupported) and cleans the watch up
 * when the screen unmounts.
 *
 * A continuous `watchPosition` is used instead of a single reading because the
 * accuracy circle on the capture screen keeps tightening while the user holds
 * the phone still — and the heading attribute updates as they turn.
 */
export function useGeolocation(options: { autoStart?: boolean } = {}) {
  const { autoStart = true } = options
  const [snapshot, setSnapshot] = useState<GeolocationSnapshot>({
    status: 'idle',
    coords: null,
    error: null,
    updatedAt: null,
  })

  const watchId = useRef<number | null>(null)
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator

  const handleSuccess = useCallback((position: GeolocationPosition) => {
    const { latitude, longitude, accuracy, altitude, heading } = position.coords
    setSnapshot({
      status: 'ready',
      coords: {
        lat: latitude,
        lng: longitude,
        accuracy: typeof accuracy === 'number' ? accuracy : null,
        altitude: typeof altitude === 'number' ? altitude : null,
        heading: typeof heading === 'number' ? heading : null,
      },
      error: null,
      updatedAt: position.timestamp,
    })
  }, [])

  const handleError = useCallback((error: GeolocationPositionError) => {
    setSnapshot((previous) => ({
      ...previous,
      status: 'error',
      error: ERROR_MESSAGES[error.code] ?? 'Could not read your position.',
    }))
  }, [])

  const stop = useCallback(() => {
    if (watchId.current !== null && supported) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
  }, [supported])

  const start = useCallback(() => {
    if (!supported) {
      setSnapshot((previous) => ({
        ...previous,
        status: 'unsupported',
        error: 'This browser does not expose the Geolocation API.',
      }))
      return
    }
    if (watchId.current !== null) return

    setSnapshot((previous) => ({ ...previous, status: 'locating', error: null }))
    watchId.current = navigator.geolocation.watchPosition(handleSuccess, handleError, OPTIONS)
  }, [supported, handleSuccess, handleError])

  const refresh = useCallback(() => {
    if (!supported) return
    setSnapshot((previous) => ({ ...previous, status: 'locating', error: null }))
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      ...OPTIONS,
      maximumAge: 0,
    })
  }, [supported, handleSuccess, handleError])

  useEffect(() => {
    if (autoStart) start()
    return () => stop()
  }, [autoStart, start, stop])

  return { ...snapshot, isSupported: supported, start, stop, refresh }
}

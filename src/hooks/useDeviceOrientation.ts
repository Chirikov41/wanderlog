import { useCallback, useEffect, useRef, useState } from 'react'

export type OrientationPermission = 'unknown' | 'granted' | 'denied' | 'unsupported'

interface OrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number
}

interface OrientationEventConstructor {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

/**
 * Compass heading from the Device Orientation API.
 *
 * Android exposes an absolute heading straight away; iOS 13+ only grants it
 * after `DeviceOrientationEvent.requestPermission()` inside a user gesture, so
 * the UI shows an explicit "Enable compass" button when that is required.
 */
export function useDeviceOrientation() {
  const [heading, setHeading] = useState<number | null>(null)
  const [permission, setPermission] = useState<OrientationPermission>('unknown')
  const listening = useRef(false)

  const supported =
    typeof window !== 'undefined' && typeof window.DeviceOrientationEvent !== 'undefined'

  const handler = useCallback((event: Event) => {
    const orientation = event as OrientationEvent
    if (typeof orientation.webkitCompassHeading === 'number') {
      setHeading(orientation.webkitCompassHeading)
      return
    }
    if (typeof orientation.alpha === 'number') {
      // `alpha` rotates counter-clockwise around the z axis, so invert it to
      // get a compass bearing.
      setHeading((360 - orientation.alpha) % 360)
    }
  }, [])

  const enable = useCallback(async () => {
    if (!supported) {
      setPermission('unsupported')
      return
    }

    const constructor = window.DeviceOrientationEvent as unknown as OrientationEventConstructor
    if (typeof constructor.requestPermission === 'function') {
      try {
        const result = await constructor.requestPermission()
        if (result !== 'granted') {
          setPermission('denied')
          return
        }
      } catch {
        setPermission('denied')
        return
      }
    }

    window.addEventListener('deviceorientationabsolute', handler)
    window.addEventListener('deviceorientation', handler)
    listening.current = true
    setPermission('granted')
  }, [handler, supported])

  useEffect(() => {
    return () => {
      if (!listening.current) return
      window.removeEventListener('deviceorientationabsolute', handler)
      window.removeEventListener('deviceorientation', handler)
      listening.current = false
    }
  }, [handler])

  return { heading, permission, supported, enable }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { captureVideoFrame } from '../lib/image'

export type CameraStatus = 'idle' | 'starting' | 'live' | 'denied' | 'unsupported' | 'error'
export type CameraFacing = 'environment' | 'user'

const CAMERA_ERRORS: Record<string, string> = {
  NotAllowedError: 'Camera permission was denied. You can still choose a photo from your library.',
  NotFoundError: 'No camera was found on this device.',
  NotReadableError: 'Another app is already using the camera.',
  OverconstrainedError: 'This camera does not support the requested settings.',
  SecurityError: 'The camera is blocked because the page is not served over HTTPS.',
}

/**
 * Live camera preview and still capture through `navigator.mediaDevices`.
 *
 * The stream is attached to a <video> element by ref, and every capture is a
 * canvas snapshot of the current frame. Tracks are always stopped when the
 * preview closes, so the phone camera light does not stay on.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [facing, setFacing] = useState<CameraFacing>('environment')
  const [deviceCount, setDeviceCount] = useState(0)

  const stop = useCallback(() => {
    const stream = streamRef.current
    if (stream) {
      for (const track of stream.getTracks()) track.stop()
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('idle')
  }, [])

  const start = useCallback(
    async (mode: CameraFacing = 'environment') => {
      const mediaDevices = navigator.mediaDevices
      if (!mediaDevices?.getUserMedia) {
        setStatus('unsupported')
        setError('This browser does not expose a camera API. Choose a photo from your library instead.')
        return
      }

      stop()
      setStatus('starting')
      setError(null)

      try {
        const stream = await mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1920 },
            height: { ideal: 1440 },
          },
        })
        streamRef.current = stream

        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          try {
            await video.play()
          } catch {
            // Autoplay can be rejected until the user interacts; the <video>
            // element keeps the stream and will paint once it plays.
          }
        }

        setFacing(mode)
        setStatus('live')

        try {
          const devices = await mediaDevices.enumerateDevices()
          setDeviceCount(devices.filter((device) => device.kind === 'videoinput').length)
        } catch {
          setDeviceCount(1)
        }
      } catch (cause) {
        const name = cause instanceof DOMException ? cause.name : 'Error'
        setError(CAMERA_ERRORS[name] ?? 'The camera could not be started.')
        setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error')
      }
    },
    [stop],
  )

  const flip = useCallback(async () => {
    const next: CameraFacing = facing === 'environment' ? 'user' : 'environment'
    await start(next)
  }, [facing, start])

  const capture = useCallback(async (): Promise<Blob> => {
    const video = videoRef.current
    if (!video) throw new Error('The camera view is not ready.')
    return captureVideoFrame(video)
  }, [])

  useEffect(() => stop, [stop])

  return {
    videoRef,
    status,
    error,
    facing,
    canFlip: deviceCount > 1,
    isLive: status === 'live',
    start,
    stop,
    flip,
    capture,
  }
}

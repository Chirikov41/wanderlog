import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Icon } from '../../components/Icons'
import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { useCamera } from '../../hooks/useCamera'
import { useObjectUrl } from '../../hooks/useObjectUrl'
import { createPhotoRecord } from '../../lib/image'
import { tap } from '../../lib/haptics'
import type { PhotoRecord } from '../../types'

interface CameraSheetProps {
  open: boolean
  onClose: () => void
  onCapture: (photo: PhotoRecord) => void
}

/**
 * Full-screen camera sheet.
 *
 * Three paths are offered, in order of quality:
 *  1. live `getUserMedia` preview (rear camera by default) with a canvas capture;
 *  2. the operating system's camera app through `<input capture>`;
 *  3. the photo library through a plain file input.
 *
 * Paths 2 and 3 are the fallback when permission is denied or the browser has
 * no MediaDevices API (for example on an insecure origin).
 */
export function CameraSheet({ open, onClose, onCapture }: CameraSheetProps) {
  const { videoRef, status, error, canFlip, isLive, start, stop, flip, capture } = useCamera()
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const previewUrl = useObjectUrl(previewBlob)
  const libraryRef = useRef<HTMLInputElement>(null)
  const nativeCameraRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setPreviewBlob(null)
    setLocalError(null)
    setBusy(false)
    void start('environment')
    return () => stop()
  }, [open, start, stop])

  const handleShutter = async () => {
    setBusy(true)
    setLocalError(null)
    try {
      const frame = await capture()
      setPreviewBlob(frame)
      tap(18)
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Could not take the photo.')
    } finally {
      setBusy(false)
    }
  }

  const handleUse = async () => {
    if (!previewBlob) return
    setBusy(true)
    try {
      const record = await createPhotoRecord(previewBlob, 'camera')
      onCapture(record)
      onClose()
    } catch {
      setLocalError('Could not save that photo. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setLocalError(null)
    try {
      const record = await createPhotoRecord(file, 'library')
      onCapture(record)
      onClose()
    } catch {
      setLocalError('That image could not be read. Try a different one.')
    } finally {
      setBusy(false)
    }
  }

  const showFallback = !previewBlob && !isLive
  const message = localError ?? cameraMessage(status, error)

  return (
    <Sheet open={open} onClose={onClose} title={previewBlob ? 'Looking good?' : 'Take a photo'} variant="camera">
      <div className="camera">
        <div className="camera__stage">
          {previewUrl ? (
            <img className="camera__preview" src={previewUrl} alt="Preview of the photo you just took" />
          ) : (
            <>
              <video
                ref={videoRef}
                className="camera__video"
                playsInline
                muted
                autoPlay
                aria-label="Live camera preview"
              />
              {isLive ? (
                <div className="camera__frame" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}
              {showFallback ? (
                <div className="camera__fallback">
                  <Icon name="camera" size={34} />
                  <p>{message}</p>
                  <div className="row" style={{ gap: 8 }}>
                    <Button size="sm" variant="secondary" onClick={() => void start('environment')}>
                      Try camera again
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => nativeCameraRef.current?.click()}>
                      Camera app
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        {localError && isLive ? (
          <p className="camera__error">
            <Icon name="alert" size={15} />
            {localError}
          </p>
        ) : null}

        {previewBlob ? (
          <div className="camera__preview-actions">
            <Button
              variant="secondary"
              onClick={() => setPreviewBlob(null)}
              disabled={busy}
              icon={<Icon name="refresh" size={17} />}
            >
              Retake
            </Button>
            <Button onClick={handleUse} loading={busy} icon={<Icon name="check" size={17} />}>
              Use photo
            </Button>
          </div>
        ) : (
          <div className="camera__controls">
            <button
              type="button"
              className="camera__side"
              aria-label="Choose from library"
              onClick={() => libraryRef.current?.click()}
            >
              <Icon name="image" size={20} />
            </button>

            <button
              type="button"
              className="camera__shutter"
              aria-label="Take photo"
              onClick={() => void handleShutter()}
              disabled={!isLive || busy}
              style={{ opacity: !isLive ? 0.4 : 1 }}
            >
              <span />
            </button>

            {canFlip ? (
              <button
                type="button"
                className="camera__side"
                aria-label="Switch camera"
                onClick={() => void flip()}
              >
                <Icon name="flip" size={20} />
              </button>
            ) : (
              <span className="camera__sideline" aria-hidden="true" />
            )}
          </div>
        )}

        <p className="camera__caption">
          {previewBlob
            ? 'The photo is compressed and stored on this device with the entry.'
            : 'Photos stay on this device. Nothing is uploaded.'}
        </p>

        <input
          ref={libraryRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          onChange={handleFile}
        />
        <input
          ref={nativeCameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          onChange={handleFile}
        />
      </div>
    </Sheet>
  )
}

function cameraMessage(status: string, error: string | null): string {
  if (error) return error
  switch (status) {
    case 'starting':
      return 'Starting the camera…'
    case 'denied':
      return 'Camera permission was denied. Choose a photo from your library instead.'
    case 'unsupported':
      return 'This browser has no camera API. Choose a photo from your library instead.'
    default:
      return 'The camera is not available right now.'
  }
}

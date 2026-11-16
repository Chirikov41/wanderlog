import { newId } from './id'
import type { PhotoRecord } from '../types'

/** Longest edge kept for the full-size copy stored in IndexedDB. */
export const FULL_EDGE = 1600
/** Longest edge for the list thumbnail. */
export const THUMB_EDGE = 480
const FULL_QUALITY = 0.82
const THUMB_QUALITY = 0.7

type Drawable = ImageBitmap | HTMLImageElement

interface LoadedImage {
  drawable: Drawable
  width: number
  height: number
  release: () => void
}

/**
 * Decodes a blob into something canvas can draw. `createImageBitmap` is the
 * fast path (it decodes off the main thread); Safari and older browsers fall
 * back to an <img> element.
 */
async function loadImage(blob: Blob): Promise<LoadedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob)
      return {
        drawable: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      }
    } catch {
      // Some formats cannot be decoded by createImageBitmap — fall through.
    }
  }

  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return {
      drawable: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('The browser could not encode this photo.'))
      },
      'image/jpeg',
      quality,
    )
  })
}

async function renderScaled(
  image: LoadedImage,
  maxEdge: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is not available in this browser.')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image.drawable, 0, 0, width, height)

  return { blob: await canvasToBlob(canvas, quality), width, height }
}

/**
 * Turns any picked/captured image into the two JPEG blobs Wanderlog stores:
 * a full-size record (max 1600 px) and a 480 px thumbnail.
 *
 * Re-encoding keeps the IndexedDB footprint small — a 4 MB phone photo usually
 * becomes ~250 kB — and strips EXIF metadata such as GPS coordinates that the
 * user may not expect to be duplicated.
 */
export async function createPhotoRecord(
  input: Blob,
  source: PhotoRecord['source'],
): Promise<PhotoRecord> {
  const image = await loadImage(input)
  try {
    const full = await renderScaled(image, FULL_EDGE, FULL_QUALITY)
    const thumb = await renderScaled(image, THUMB_EDGE, THUMB_QUALITY)
    return {
      id: newId(),
      blob: full.blob,
      thumb: thumb.blob,
      width: full.width,
      height: full.height,
      bytes: full.blob.size,
      source,
      capturedAt: Date.now(),
    }
  } finally {
    image.release()
  }
}

/** Grabs the current camera frame as a JPEG blob. */
export async function captureVideoFrame(video: HTMLVideoElement): Promise<Blob> {
  const width = video.videoWidth
  const height = video.videoHeight
  if (!width || !height) {
    throw new Error('The camera is still warming up. Try again in a moment.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is not available in this browser.')
  context.drawImage(video, 0, 0, width, height)
  return canvasToBlob(canvas, 0.92)
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the photo.'))
    reader.readAsDataURL(blob)
  })
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl)
  return response.blob()
}

import { useEffect, useState } from 'react'

/**
 * Turns a Blob into an object URL and revokes it on unmount / when the blob
 * changes. Object URLs are the cheapest way to display IndexedDB blobs, but
 * they must be released or the tab slowly leaks memory.
 */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => {
      URL.revokeObjectURL(next)
    }
  }, [blob])

  return url
}

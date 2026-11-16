import { useObjectUrl } from '../../hooks/useObjectUrl'
import type { PhotoRecord } from '../../types'
import { Icon } from '../Icons'

interface PhotoProps {
  photo: PhotoRecord | null
  alt: string
  variant?: 'card' | 'thumb' | 'hero'
  eager?: boolean
}

/**
 * Renders a stored photo. Lists use the 480px thumbnail; the detail hero uses
 * the full-size blob. Blob URLs are created and revoked inside `useObjectUrl`,
 * which is what keeps long scrolling sessions from leaking memory.
 */
export function Photo({ photo, alt, variant = 'card', eager = false }: PhotoProps) {
  const source = variant === 'hero' ? (photo?.blob ?? null) : (photo?.thumb ?? photo?.blob ?? null)
  const url = useObjectUrl(source)

  if (!url) {
    return (
      <div className={`photo photo--${variant} photo--empty`} aria-hidden="true">
        <Icon name="image" size={variant === 'hero' ? 40 : 26} />
      </div>
    )
  }

  return (
    <img
      className={`photo photo--${variant}`}
      src={url}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
    />
  )
}

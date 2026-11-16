import { useState } from 'react'
import { StarGlyph } from '../Icons'

interface StarRatingProps {
  value: number
  onChange?: (value: number) => void
  size?: number
  readonly?: boolean
}

export function StarRating({ value, onChange, size = 30, readonly = false }: StarRatingProps) {
  const [hovered, setHovered] = useState(0)
  const active = hovered || value

  if (readonly) {
    return (
      <div className="rating rating--readonly" role="img" aria-label={`Rated ${value} out of 5`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className={star <= value ? 'is-on' : ''}>
            <StarGlyph filled={star <= value} size={size} />
          </span>
        ))}
      </div>
    )
  }

  return (
    <div
      className="rating"
      role="group"
      aria-label="Rating out of five"
      onMouseLeave={() => setHovered(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={['rating__btn', star <= active ? 'is-on' : ''].filter(Boolean).join(' ')}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          aria-pressed={star === value}
          onMouseEnter={() => setHovered(star)}
          onFocus={() => setHovered(star)}
          onBlur={() => setHovered(0)}
          onClick={() => onChange?.(star === value ? 0 : star)}
        >
          <StarGlyph filled={star <= active} size={size} />
        </button>
      ))}
    </div>
  )
}

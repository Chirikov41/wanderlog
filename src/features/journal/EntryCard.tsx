import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icons'
import { Photo } from '../../components/ui/Photo'
import { categoryMeta } from '../../lib/categories'
import { formatDate, truncate } from '../../lib/format'
import type { Entry } from '../../types'

interface EntryCardProps {
  entry: Entry
  index?: number
}

export function EntryCard({ entry, index = 0 }: EntryCardProps) {
  const category = categoryMeta(entry.category)

  return (
    <Link
      to={`/entry/${entry.id}`}
      className="entry-card"
      style={{ animationDelay: `${Math.min(index, 7) * 55}ms` }}
    >
      <div className="entry-card__media">
        <Photo photo={entry.photo} alt={entry.title} />
        <span
          className="entry-card__tag"
          style={{ background: category.soft, color: category.colour }}
        >
          {category.label}
        </span>
        {entry.rating > 0 ? (
          <span className="entry-card__rating" aria-label={`Rated ${entry.rating} out of 5`}>
            {entry.rating}
            <Icon name="star" size={11} />
          </span>
        ) : null}
      </div>

      <div className="entry-card__body">
        <h2>{entry.title}</h2>
        <p className="entry-card__meta">
          <Icon name="pin" size={13} />
          <span>
            {entry.place.name || 'Unknown place'} · {formatDate(entry.visitedAt)}
          </span>
        </p>
        {entry.notes ? <p className="entry-card__notes">{truncate(entry.notes, 116)}</p> : null}
      </div>
    </Link>
  )
}

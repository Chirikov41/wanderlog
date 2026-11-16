import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { Icon } from '../../components/Icons'
import { Button, IconButton } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { Photo } from '../../components/ui/Photo'
import { Spinner } from '../../components/ui/Spinner'
import { StarRating } from '../../components/ui/StarRating'
import { useToast } from '../../components/ui/Toast'
import { categoryMeta } from '../../lib/categories'
import { deleteEntry, useEntry } from '../../lib/entries.repo'
import { formatCoordinates } from '../../lib/geo'
import { formatDate, formatLongDate, formatRelative } from '../../lib/format'
import { tap } from '../../lib/haptics'
import { shareEntry } from '../../lib/share'
import { LazyTripMap } from '../map/LazyTripMap'

export function EntryPage() {
  const { id } = useParams<{ id: string }>()
  const entry = useEntry(id)
  const navigate = useNavigate()
  const toast = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (entry === undefined) {
    return (
      <div className="page">
        <div className="loading-page">
          <Spinner size={26} />
        </div>
      </div>
    )
  }

  if (entry === null) {
    return (
      <div className="page">
        <AppHeader back title="Memory" />
        <EmptyState
          title="This memory is gone"
          message="It may have been deleted on another screen."
          action={
            <Link to="/" className="btn btn--primary">
              Back to the journal
            </Link>
          }
        />
      </div>
    )
  }

  const category = categoryMeta(entry.category)
  const placeLabel =
    entry.place.name ||
    (entry.coords
      ? `Near ${entry.coords.lat.toFixed(2)}, ${entry.coords.lng.toFixed(2)}`
      : 'Unknown place')

  const handleShare = async () => {
    const result = await shareEntry(entry)
    if (result === 'copied') toast.show('Details copied to the clipboard')
    if (result === 'unsupported') toast.show('Sharing is not available in this browser.', 'error')
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteEntry(entry.id)
      tap([12, 50, 12])
      toast.show('Memory deleted', 'success')
      navigate('/', { replace: true })
    } catch {
      toast.show('Could not delete this memory.', 'error')
      setDeleting(false)
    }
  }

  return (
    <div className="page" style={{ paddingTop: 0 }}>
      <div className={entry.photo ? 'entry-hero' : 'entry-hero entry-hero--text'}>
        {entry.photo ? <Photo photo={entry.photo} alt={entry.title} variant="hero" eager /> : null}
        <div className="entry-hero__shade" />

        <div className="entry-hero__bar">
          <IconButton label="Go back" variant="solid" onClick={() => navigate(-1)}>
            <Icon name="back" />
          </IconButton>
          <div className="entry-hero__tools">
            <IconButton
              label="Share this memory"
              variant="solid"
              onClick={() => void handleShare()}
            >
              <Icon name="share" size={19} />
            </IconButton>
            <IconButton
              label="Edit this memory"
              variant="solid"
              onClick={() => navigate(`/edit/${entry.id}`)}
            >
              <Icon name="edit" size={19} />
            </IconButton>
          </div>
        </div>

        <div className="entry-hero__caption">
          <span className="badge" style={{ background: category.soft, color: category.colour }}>
            {category.label}
          </span>
          <h1>{entry.title}</h1>
          <p>
            <Icon name="pin" size={15} />
            {placeLabel} · {formatLongDate(entry.visitedAt)}
          </p>
        </div>
      </div>

      <div className="entry-body">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <StarRating value={entry.rating} readonly size={17} />
          <span className="muted" style={{ fontSize: 12 }}>
            Updated {formatRelative(entry.updatedAt)}
          </span>
        </div>

        {entry.notes ? (
          <section className="entry-section">
            <h2>Notes</h2>
            <p className="entry-notes">{entry.notes}</p>
          </section>
        ) : null}

        <section className="entry-section">
          <h2>On the map</h2>
          <div className="map-card">
            {entry.coords ? (
              <>
                <div className="map-card__map">
                  <LazyTripMap entries={[entry]} interactive={false} />
                </div>
                <div className="map-card__foot">
                  <span>{formatCoordinates(entry.coords, 4)}</span>
                  <a
                    className="map-card__link"
                    href={`https://www.openstreetmap.org/?mlat=${entry.coords.lat}&mlon=${entry.coords.lng}#map=14/${entry.coords.lat}/${entry.coords.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open <Icon name="external" size={12} />
                  </a>
                </div>
              </>
            ) : (
              <div className="center-block">
                <Icon name="map" size={26} />
                <p>No coordinates were saved for this memory.</p>
              </div>
            )}
          </div>
        </section>

        <dl className="entry-meta-grid">
          <div className="entry-meta">
            <dt>Place</dt>
            <dd>{placeLabel}</dd>
          </div>
          <div className="entry-meta">
            <dt>Visited</dt>
            <dd>{formatDate(entry.visitedAt)}</dd>
          </div>
          <div className="entry-meta">
            <dt>Region</dt>
            <dd>{[entry.place.region, entry.place.country].filter(Boolean).join(', ') || '—'}</dd>
          </div>
          <div className="entry-meta">
            <dt>Photo</dt>
            <dd>{entry.photo ? `${entry.photo.width}×${entry.photo.height}` : 'None'}</dd>
          </div>
        </dl>

        <div className="entry-actions">
          <Button
            variant="secondary"
            icon={<Icon name="share" size={17} />}
            onClick={() => void handleShare()}
          >
            Share
          </Button>
          <Button
            variant="danger"
            icon={<Icon name="trash" size={17} />}
            onClick={() => setConfirmOpen(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this memory?"
        message="The entry and its photo will be removed from this device. This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}


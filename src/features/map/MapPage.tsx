import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { Icon } from '../../components/Icons'
import { EmptyState } from '../../components/ui/EmptyState'
import { Photo } from '../../components/ui/Photo'
import { Spinner } from '../../components/ui/Spinner'
import { useEntries } from '../../lib/entries.repo'
import { formatCount, formatDate } from '../../lib/format'
import { formatDistance } from '../../lib/geo'
import { summarise } from '../../lib/stats'
import { LazyTripMap } from './LazyTripMap'

export function MapPage() {
  const entries = useEntries()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (entries === undefined) {
    return (
      <div className="page">
        <div className="loading-page">
          <Spinner size={26} />
        </div>
      </div>
    )
  }

  const located = entries.filter((entry) => entry.coords)

  if (located.length === 0) {
    return (
      <div className="page">
        <AppHeader eyebrow="Your journey" title="Map" />
        <EmptyState
          icon="map"
          title="No pins yet"
          message="Every memory with a location is dropped onto this map. Allow location access the next time you log a place."
          action={
            <Link to="/new" className="btn btn--primary">
              <Icon name="plus" size={18} />
              <span className="btn__label">Log a place</span>
            </Link>
          }
        />
      </div>
    )
  }

  const summary = summarise(located)
  const selected = located.find((entry) => entry.id === selectedId) ?? null

  return (
    <div className="page page--map">
      <div className="map-page">
        <div className="map-page__map">
          <LazyTripMap
            entries={located}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
          />
        </div>

        <div className="map-page__top">
          <div className="map-page__title">
            <p className="eyebrow">Your journey</p>
            <h1>{formatCount(located.length, 'pin')}</h1>
          </div>
          <span className="map-page__pill">
            <Icon name="nav" size={13} />
            {summary.distanceKm >= 1 ? formatDistance(summary.distanceKm) : '0 km'}
          </span>
        </div>

        <div className="map-sheet" key={selected?.id ?? 'hint'}>
          {selected ? (
            <div className="map-sheet__card">
              <div className="map-sheet__thumb">
                <Photo photo={selected.photo} alt="" variant="thumb" />
              </div>
              <div className="map-sheet__body">
                <h2>{selected.title}</h2>
                <p>
                  {selected.place.name || 'Unknown place'} · {formatDate(selected.visitedAt)}
                </p>
              </div>
              <Link
                to={`/entry/${selected.id}`}
                className="map-sheet__go"
                aria-label={`Open ${selected.title}`}
              >
                <Icon name="forward" size={18} />
              </Link>
            </div>
          ) : (
            <p className="map-sheet__hint">
              <Icon name="pin" size={15} />
              Tap a pin to read the story behind it.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}


import { Icon } from '../../components/Icons'
import { Button, IconButton } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Spinner } from '../../components/ui/Spinner'
import type { GeolocationStatus } from '../../hooks/useGeolocation'
import type { OrientationPermission } from '../../hooks/useDeviceOrientation'
import { accuracyBand, compassPoint, formatCoordinates } from '../../lib/geo'
import { formatRelative } from '../../lib/format'
import type { Coordinates, PlaceInfo } from '../../types'

interface LocationCardProps {
  status: GeolocationStatus
  coords: Coordinates | null
  error: string | null
  updatedAt: number | null
  onRefresh: () => void
  place: PlaceInfo
  onPlaceChange: (place: PlaceInfo) => void
  lookup: 'idle' | 'loading' | 'done' | 'failed'
  heading: number | null
  compassPermission: OrientationPermission
  compassSupported: boolean
  onEnableCompass: () => void
  placeError?: string
}

/**
 * The "Where were you?" block: GPS status, coordinates, facing direction and
 * the editable place metadata. Split out from the form page so the page itself
 * stays readable.
 */
export function LocationCard({
  status,
  coords,
  error,
  updatedAt,
  onRefresh,
  place,
  onPlaceChange,
  lookup,
  heading,
  compassPermission,
  compassSupported,
  onEnableCompass,
  placeError,
}: LocationCardProps) {
  const canAskForCompass = compassSupported && heading === null && compassPermission !== 'denied'

  return (
    <section className="card stack" aria-labelledby="location-title">
      <div className="location__head">
        <div>
          <span className="eyebrow">Step 2</span>
          <h2 id="location-title">Where were you?</h2>
        </div>
        <AccuracyPill accuracy={coords?.accuracy ?? null} status={status} />
      </div>

      {status === 'locating' && !coords ? (
        <div className="notice">
          <Spinner size={16} />
          <p>Finding your position. Keep the phone still for a better fix.</p>
        </div>
      ) : null}

      {status === 'error' && error ? (
        <div className="notice notice--warn">
          <Icon name="alert" size={17} />
          <p>{error}</p>
        </div>
      ) : null}

      {status === 'unsupported' ? (
        <div className="notice">
          <Icon name="info" size={17} />
          <p>This browser has no Geolocation API. Type the place name below instead.</p>
        </div>
      ) : null}

      <div className="location__coords">
        <div>
          <span className="location__value">
            {coords ? formatCoordinates(coords) : 'Not pinned yet'}
          </span>
          <span className="location__meta">
            {coords
              ? `± ${Math.round(coords.accuracy ?? 0)} m${
                  updatedAt ? ` · updated ${formatRelative(updatedAt)}` : ''
                }`
              : status === 'locating'
                ? 'Waiting for a fix…'
                : 'Tap refresh to take a new reading'}
          </span>
        </div>
        <IconButton label="Refresh location" variant="outline" onClick={onRefresh}>
          <Icon name="refresh" size={18} />
        </IconButton>
      </div>

      <div className="location__compass">
        <CompassDial heading={heading} />
        <div className="location__compass-text">
          <strong>
            {heading !== null ? `${compassPoint(heading)} · ${Math.round(heading)}°` : 'Compass idle'}
          </strong>
          <span>
            {heading !== null
              ? 'Facing direction recorded with this memory'
              : compassSupported
                ? 'Adds the direction you were facing'
                : 'This device has no orientation sensor'}
          </span>
        </div>
        {canAskForCompass ? (
          <Button size="sm" variant="secondary" onClick={onEnableCompass}>
            Enable
          </Button>
        ) : null}
      </div>

      <Field
        label="Place name"
        htmlFor="place-name"
        error={placeError}
        hint="Filled in automatically when the geocoder answers — edit it freely."
      >
        <input
          id="place-name"
          className="input"
          value={place.name}
          onChange={(event) => onPlaceChange({ ...place, name: event.target.value })}
          placeholder="Quiraing, Isle of Skye"
          autoComplete="off"
        />
      </Field>

      <div className="form-grid">
        <Field label="Region" htmlFor="place-region" optional>
          <input
            id="place-region"
            className="input"
            value={place.region ?? ''}
            onChange={(event) => onPlaceChange({ ...place, region: event.target.value })}
            placeholder="Highland"
            autoComplete="off"
          />
        </Field>
        <Field label="Country" htmlFor="place-country" optional>
          <input
            id="place-country"
            className="input"
            value={place.country ?? ''}
            onChange={(event) => onPlaceChange({ ...place, country: event.target.value })}
            placeholder="Scotland"
            autoComplete="off"
          />
        </Field>
      </div>

      {lookup === 'loading' ? (
        <p className="location__hint">
          <Spinner size={12} /> Looking up this spot on OpenStreetMap…
        </p>
      ) : null}
      {lookup === 'done' ? (
        <p className="location__hint location__hint--ok">
          <Icon name="check" size={14} /> Name filled from OpenStreetMap. Edit it if you like.
        </p>
      ) : null}
      {lookup === 'failed' ? (
        <p className="location__hint">
          <Icon name="info" size={14} /> Geocoder unavailable — your coordinates are still saved.
        </p>
      ) : null}
    </section>
  )
}

function AccuracyPill({
  accuracy,
  status,
}: {
  accuracy: number | null
  status: GeolocationStatus
}) {
  if (status === 'locating') {
    return (
      <span className="accuracy">
        <Spinner size={11} /> locating
      </span>
    )
  }
  if (accuracy === null) {
    return <span className="accuracy">no fix</span>
  }
  const band = accuracyBand(accuracy)
  return (
    <span className={`accuracy accuracy--${band}`}>
      <span className="accuracy__dot" />±{Math.round(accuracy)} m
    </span>
  )
}

function CompassDial({ heading }: { heading: number | null }) {
  return (
    <svg className="compass" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" strokeOpacity="0.18" />
      <circle cx="32" cy="32" r="23" fill="none" stroke="currentColor" strokeOpacity="0.08" />
      <text x="32" y="12" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor" opacity="0.55">
        N
      </text>
      <text x="32" y="59" textAnchor="middle" fontSize="7" fill="currentColor" opacity="0.32">
        S
      </text>
      <text x="8" y="35" textAnchor="middle" fontSize="7" fill="currentColor" opacity="0.32">
        W
      </text>
      <text x="56" y="35" textAnchor="middle" fontSize="7" fill="currentColor" opacity="0.32">
        E
      </text>
      <g
        className="compass__needle"
        style={{ transform: `rotate(${heading ?? 0}deg)`, transformOrigin: '32px 32px' }}
      >
        <path d="M32 15 L36.5 34 L32 30.5 L27.5 34 Z" fill="var(--accent)" />
      </g>
      <circle cx="32" cy="32" r="2.2" fill="currentColor" opacity="0.55" />
    </svg>
  )
}

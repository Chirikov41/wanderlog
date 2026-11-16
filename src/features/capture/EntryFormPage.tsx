import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { Icon } from '../../components/Icons'
import { Button } from '../../components/ui/Button'
import { Chip } from '../../components/ui/Chip'
import { Field } from '../../components/ui/Field'
import { Photo } from '../../components/ui/Photo'
import { Spinner } from '../../components/ui/Spinner'
import { StarRating } from '../../components/ui/StarRating'
import { useToast } from '../../components/ui/Toast'
import { useDeviceOrientation } from '../../hooks/useDeviceOrientation'
import { useGeolocation } from '../../hooks/useGeolocation'
import { CATEGORIES } from '../../lib/categories'
import { emptyDraft, entryToDraft } from '../../lib/draft'
import { createEntry, updateEntry, useEntry } from '../../lib/entries.repo'
import { formatDate, fromDateInputValue, toDateInputValue } from '../../lib/format'
import { reverseGeocode } from '../../lib/geocode'
import { NOTES_MAX, hasErrors, validateEntryDraft, type EntryErrors } from '../../lib/validation'
import type { Coordinates, EntryDraft } from '../../types'
import { CameraSheet } from './CameraSheet'
import { LocationCard } from './LocationCard'

type LookupState = 'idle' | 'loading' | 'done' | 'failed'

/**
 * One form for both "create" and "edit": `/new` and `/edit/:id` render the same
 * screen, and React Router supplies the id that switches the repository call.
 */
export function EntryFormPage() {
  const { id } = useParams<{ id: string }>()
  const editing = Boolean(id)
  const existing = useEntry(id)
  const navigate = useNavigate()
  const toast = useToast()

  const [draft, setDraft] = useState<EntryDraft>(emptyDraft)
  const [errors, setErrors] = useState<EntryErrors>({})
  const [ready, setReady] = useState(!editing)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lookup, setLookup] = useState<LookupState>('idle')

  const geo = useGeolocation({ autoStart: !editing })
  const compass = useDeviceOrientation()

  // Prefill the form once the entry has been read from IndexedDB.
  useEffect(() => {
    if (!editing || ready) return
    if (existing === undefined) return
    if (existing === null) {
      toast.show('That memory no longer exists.', 'error')
      navigate('/', { replace: true })
      return
    }
    setDraft(entryToDraft(existing))
    setReady(true)
  }, [editing, ready, existing, navigate, toast])

  // Resolve a place name the first time a fix arrives, unless the user has
  // already typed one. The geocoder is throttled and cached in lib/geocode.ts.
  const geoKey = geo.coords
    ? `${geo.coords.lat.toFixed(4)},${geo.coords.lng.toFixed(4)}`
    : null

  useEffect(() => {
    if (!geoKey || !geo.coords) return
    if (draft.place.name.trim()) return
    const { lat, lng } = geo.coords
    let cancelled = false

    setLookup('loading')
    void reverseGeocode(lat, lng).then((place) => {
      if (cancelled) return
      if (!place) {
        setLookup('failed')
        return
      }
      setDraft((previous) =>
        previous.place.name.trim() ? previous : { ...previous, place: { ...place } },
      )
      setLookup('done')
    })

    return () => {
      cancelled = true
    }
  }, [geoKey, draft.place.name, geo.coords])

  const update = (patch: Partial<EntryDraft>) => {
    setDraft((previous) => ({ ...previous, ...patch }))
    if (hasErrors(errors)) setErrors({})
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validateEntryDraft(draft)
    setErrors(nextErrors)

    if (hasErrors(nextErrors)) {
      toast.show(nextErrors.title ?? nextErrors.place ?? 'Check the highlighted fields.', 'error')
      return
    }

    const coords: Coordinates | null = geo.coords
      ? { ...geo.coords, heading: compass.heading ?? geo.coords.heading ?? null }
      : draft.coords

    const payload: EntryDraft = {
      title: draft.title.trim(),
      notes: draft.notes.trim(),
      category: draft.category,
      rating: draft.rating,
      visitedAt: draft.visitedAt,
      place: {
        name: draft.place.name.trim(),
        region: draft.place.region?.trim() ?? '',
        country: draft.place.country?.trim() ?? '',
      },
      coords,
      photo: draft.photo,
    }

    setSaving(true)
    try {
      if (editing && id) {
        await updateEntry(id, payload)
        toast.show('Memory updated', 'success')
        navigate(`/entry/${id}`, { replace: true })
      } else {
        const created = await createEntry(payload)
        toast.show('Memory saved', 'success')
        navigate(`/entry/${created.id}`, { replace: true })
      }
    } catch {
      toast.show('Could not save this memory. Please try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (editing && !ready) {
    return (
      <div className="page page--form">
        <AppHeader back title="Edit memory" />
        <div className="loading-page">
          <Spinner size={26} />
        </div>
      </div>
    )
  }

  return (
    <div className="page page--form">
      <AppHeader
        back
        eyebrow={editing ? 'Editing' : 'New memory'}
        title={editing ? 'Edit memory' : 'Pin a new place'}
        subtitle={editing ? 'Change anything and save' : `${formatDate(draft.visitedAt)} · on this device`}
      />

      <form id="entry-form" className="stack" style={{ gap: 26 }} onSubmit={handleSubmit} noValidate>
        <section className="form-section">
          <div className="form-section__head">
            <h2>Photo</h2>
            <span className="eyebrow">Step 1 · optional</span>
          </div>

          <div className="photo-slot">
            {draft.photo ? (
              <div className="photo-slot__preview">
                <Photo photo={draft.photo} alt="The photo saved with this memory" eager />
                <div className="photo-slot__actions">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Icon name="camera" size={16} />}
                    onClick={() => setCameraOpen(true)}
                  >
                    Retake
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Icon name="trash" size={16} />}
                    onClick={() => update({ photo: null })}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <button type="button" className="photo-slot__empty" onClick={() => setCameraOpen(true)}>
                <span className="photo-slot__icon">
                  <Icon name="camera" size={26} />
                </span>
                <strong>Add a photo</strong>
                <span>Use the camera or pick one from your library</span>
              </button>
            )}
          </div>
        </section>

        <LocationCard
          status={geo.status}
          coords={geo.coords}
          error={geo.error}
          updatedAt={geo.updatedAt}
          onRefresh={geo.refresh}
          place={draft.place}
          onPlaceChange={(place) => update({ place })}
          lookup={lookup}
          heading={compass.heading}
          compassPermission={compass.permission}
          compassSupported={compass.supported}
          onEnableCompass={() => void compass.enable()}
          placeError={errors.place}
        />

        <section className="form-section">
          <div className="form-section__head">
            <h2>The story</h2>
            <span className="eyebrow">Step 3</span>
          </div>

          <Field label="Title" htmlFor="entry-title" error={errors.title}>
            <input
              id="entry-title"
              className="input"
              value={draft.title}
              maxLength={90}
              onChange={(event) => update({ title: event.target.value })}
              placeholder="Mist over the Quiraing"
              autoComplete="off"
            />
          </Field>

          <Field
            label="Notes"
            htmlFor="entry-notes"
            counter={`${draft.notes.length} / ${NOTES_MAX}`}
            error={errors.notes}
          >
            <textarea
              id="entry-notes"
              className="textarea"
              value={draft.notes}
              onChange={(event) => update({ notes: event.target.value })}
              placeholder="What happened? Who were you with? What could you hear?"
            />
          </Field>

          <div className="field">
            <span className="field__label">Category</span>
            <div className="chip-wrap" role="group" aria-label="Category">
              {CATEGORIES.map((category) => (
                <Chip
                  key={category.id}
                  colour={category.colour}
                  selected={draft.category === category.id}
                  onClick={() => update({ category: category.id })}
                >
                  {category.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field__label">Rating</span>
            <div className="row">
              <StarRating value={draft.rating} onChange={(rating) => update({ rating })} />
              <span className="muted" style={{ fontSize: 12.5 }}>
                {draft.rating === 0 ? 'Not rated yet' : `${draft.rating} of 5`}
              </span>
            </div>
            {errors.rating ? <p className="field__error">{errors.rating}</p> : null}
          </div>

          <Field label="Visited on" htmlFor="entry-date">
            <input
              id="entry-date"
              type="date"
              className="input"
              value={toDateInputValue(draft.visitedAt)}
              max={toDateInputValue(Date.now())}
              onChange={(event) => {
                const timestamp = fromDateInputValue(event.target.value)
                if (timestamp) update({ visitedAt: timestamp })
              }}
            />
          </Field>
        </section>

        <p className="notice">
          <Icon name="lock" size={16} />
          <span>
            Everything — photos included — is written to this device's IndexedDB. No account, no
            upload.
          </span>
        </p>
      </form>

      <div className="form-footer">
        <Button
          type="submit"
          form="entry-form"
          block
          size="lg"
          loading={saving}
          icon={<Icon name="check" size={18} />}
        >
          {editing ? 'Save changes' : 'Save memory'}
        </Button>
      </div>

      <CameraSheet
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(photo) => update({ photo })}
      />
    </div>
  )
}

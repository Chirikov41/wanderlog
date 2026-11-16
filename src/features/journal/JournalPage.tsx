import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icons'
import { Button } from '../../components/ui/Button'
import { Chip } from '../../components/ui/Chip'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { CATEGORIES } from '../../lib/categories'
import { seedDemoTrip } from '../../lib/demo'
import { useEntries } from '../../lib/entries.repo'
import { formatCount, greeting } from '../../lib/format'
import { formatDistance } from '../../lib/geo'
import { summarise } from '../../lib/stats'
import type { CategoryId } from '../../types'
import { EntryCard } from './EntryCard'

export function JournalPage() {
  const entries = useEntries()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryId | 'all'>('all')
  const [seeding, setSeeding] = useState(false)

  const list = entries ?? []
  const summary = useMemo(() => summarise(list), [list])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return list.filter((entry) => {
      if (category !== 'all' && entry.category !== category) return false
      if (!needle) return true
      return [entry.title, entry.notes, entry.place.name, entry.place.region, entry.place.country]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [list, query, category])

  const filtersActive = query.trim().length > 0 || category !== 'all'
  const loading = entries === undefined

  async function handleLoadSample() {
    setSeeding(true)
    try {
      const count = await seedDemoTrip()
      toast.show(`Added ${formatCount(count, 'sample memory', 'sample memories')}`, 'success')
    } catch {
      toast.show('Could not load the sample trip.', 'error')
    } finally {
      setSeeding(false)
    }
  }

  function clearFilters() {
    setQuery('')
    setCategory('all')
  }

  return (
    <div className="page">
      <header className="journal-head">
        <div className="journal-head__top">
          <div>
            <p className="eyebrow">{greeting()}</p>
            <h1 className="display">Wanderlog</h1>
            <p className="journal-head__greeting">
              {list.length === 0
                ? 'A travel journal that stays on your phone. Pin a place, keep a photo, remember the day.'
                : `${formatCount(list.length, 'memory', 'memories')} pinned across ${formatCount(
                    summary.regions.length || list.length,
                    'place',
                  )}.`}
            </p>
          </div>
          <Link to="/settings" className="icon-btn icon-btn--outline" aria-label="Settings">
            <Icon name="sliders" size={20} />
          </Link>
        </div>

        <section className="ticket" aria-label="Journal summary">
          <div className="ticket__stats">
            <div className="ticket__stat">
              <span className="ticket__value">{summary.entries}</span>
              <span className="ticket__label">memories</span>
            </div>
            <div className="ticket__stat">
              <span className="ticket__value">{summary.photos}</span>
              <span className="ticket__label">photos</span>
            </div>
            <div className="ticket__stat">
              <span className="ticket__value">
                {summary.distanceKm >= 1 ? formatDistance(summary.distanceKm) : '—'}
              </span>
              <span className="ticket__label">travelled</span>
            </div>
          </div>
          <div className="ticket__action">
            <Link to="/new" className="btn btn--sun btn--block">
              <Icon name="plus" size={18} />
              <span className="btn__label">Pin a new place</span>
            </Link>
          </div>
        </section>
      </header>

      {list.length > 0 ? (
        <div className="journal-tools">
          <div className="search">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search places, titles, notes"
              aria-label="Search memories"
              enterKeyHint="search"
            />
            {query ? (
              <button
                type="button"
                className="search__clear"
                aria-label="Clear search"
                onClick={() => setQuery('')}
              >
                <Icon name="close" size={15} />
              </button>
            ) : null}
          </div>

          <div className="chip-row" role="group" aria-label="Filter by category">
            <Chip selected={category === 'all'} onClick={() => setCategory('all')} count={list.length}>
              All
            </Chip>
            {CATEGORIES.filter((item) => summary.categories[item.id] > 0).map((item) => (
              <Chip
                key={item.id}
                colour={item.colour}
                selected={category === item.id}
                onClick={() => setCategory(category === item.id ? 'all' : item.id)}
              >
                {item.label}
              </Chip>
            ))}
          </div>

          {filtersActive ? (
            <p className="journal-results">
              {formatCount(filtered.length, 'memory', 'memories')} match
              {filtered.length === 1 ? 'es' : ''} your filters
            </p>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="entry-list" aria-hidden="true">
          {[0, 1].map((key) => (
            <div key={key} className="skeleton-card">
              <div className="skeleton skeleton-card__media" />
              <div className="skeleton-card__body">
                <div className="skeleton skeleton-line" style={{ width: '62%' }} />
                <div className="skeleton skeleton-line" style={{ width: '40%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="entry-list">
          {filtered.map((entry, index) => (
            <EntryCard key={entry.id} entry={entry} index={index} />
          ))}
        </div>
      ) : list.length > 0 ? (
        <EmptyState
          icon="search"
          title="Nothing matches"
          message="Try a different word, or clear the filters to see the whole journal."
          action={
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <EmptyState
          title="Your first memory is waiting"
          message="Pin where you are, snap a photo and write a line about the day. It is saved on this device, even without signal."
          action={
            <>
              <Link to="/new" className="btn btn--primary">
                <Icon name="camera" size={18} />
                <span className="btn__label">Log a place</span>
              </Link>
              <Button variant="secondary" loading={seeding} onClick={handleLoadSample}>
                Load a sample trip
              </Button>
            </>
          }
        />
      )}
    </div>
  )
}

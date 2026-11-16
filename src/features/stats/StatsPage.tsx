import { Link } from 'react-router-dom'
import { AppHeader } from '../../components/AppHeader'
import { Icon } from '../../components/Icons'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { useEntries } from '../../lib/entries.repo'
import { formatDate } from '../../lib/format'
import { formatDistance } from '../../lib/geo'
import { categoryBreakdown, monthlyActivity, summarise } from '../../lib/stats'

export function StatsPage() {
  const entries = useEntries()

  if (entries === undefined) {
    return (
      <div className="page">
        <div className="loading-page">
          <Spinner size={26} />
        </div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="page">
        <AppHeader eyebrow="Your journey" title="Stats" />
        <EmptyState
          icon="chart"
          title="Numbers need memories"
          message="Once you log a few places this screen fills up: distance travelled, categories and your busiest months."
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

  const summary = summarise(entries)
  const months = monthlyActivity(entries, 6)
  const breakdown = categoryBreakdown(entries)
  const maxCategory = Math.max(1, ...breakdown.map((item) => item.count))
  const maxMonth = Math.max(1, ...months.map((item) => item.count))
  const monthsTotal = months.reduce((total, item) => total + item.count, 0)

  const topRated = [...entries]
    .filter((entry) => entry.rating > 0)
    .sort((a, b) => b.rating - a.rating || b.visitedAt - a.visitedAt)
    .slice(0, 3)

  return (
    <div className="page">
      <AppHeader eyebrow="Your journey" title="Stats" />

      <div className="metric-grid">
        <div className="metric metric--brand">
          <div className="metric__value">{summary.entries}</div>
          <div className="metric__label">memories</div>
        </div>
        <div className="metric">
          <div className="metric__value">{summary.regions.length}</div>
          <div className="metric__label">places</div>
        </div>
        <div className="metric">
          <div className="metric__value">
            {summary.distanceKm >= 1 ? Math.round(summary.distanceKm) : '—'}
            <span style={{ fontSize: 14, fontWeight: 600 }}> km</span>
          </div>
          <div className="metric__label">crow flies</div>
        </div>
        <div className="metric">
          <div className="metric__value">
            {summary.averageRating > 0 ? summary.averageRating.toFixed(1) : '—'}
          </div>
          <div className="metric__label">avg rating</div>
        </div>
      </div>

      <section className="card">
        <div className="section-title">
          <h2>Last six months</h2>
          <span className="eyebrow">{monthsTotal} memories</span>
        </div>
        <div className="activity" role="img" aria-label="Memories per month for the last six months">
          {months.map((month) => (
            <div className="activity__col" key={month.key}>
              <span className="activity__count">{month.count || ''}</span>
              <div
                className="activity__bar"
                style={{ height: `${Math.max(3, Math.round((month.count / maxMonth) * 100))}%` }}
              />
              <span className="activity__label">{month.label}</span>
            </div>
          ))}
        </div>
      </section>

      {breakdown.length > 0 ? (
        <section className="card">
          <div className="section-title">
            <h2>Categories</h2>
            <span className="eyebrow">{breakdown.length} in use</span>
          </div>
          <div className="cat-bars">
            {breakdown.map((item) => (
              <div key={item.id}>
                <div className="cat-bar__head">
                  <span>{item.label}</span>
                  <span className="muted">{item.count}</span>
                </div>
                <div className="cat-bar__track">
                  <div
                    className="cat-bar__fill"
                    style={{
                      width: `${Math.round((item.count / maxCategory) * 100)}%`,
                      background: item.colour,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {topRated.length > 0 ? (
        <section className="card">
          <div className="section-title">
            <h2>Highest rated</h2>
            <span className="eyebrow">out of five</span>
          </div>
          <div className="top-list">
            {topRated.map((entry, index) => (
              <Link key={entry.id} to={`/entry/${entry.id}`} className="top-item">
                <span className="top-item__rank">{index + 1}</span>
                <span className="top-item__body">
                  <strong>{entry.title}</strong>
                  <span>
                    {formatDate(entry.visitedAt)} · {entry.rating}/5
                  </span>
                </span>
                <Icon name="forward" size={16} />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {summary.regions.length > 0 ? (
        <section className="card">
          <div className="section-title">
            <h2>Where you have been</h2>
          </div>
          <div className="chip-wrap">
            {summary.regions.map((region) => (
              <span key={region} className="chip" style={{ pointerEvents: 'none' }}>
                {region}
              </span>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            {summary.distanceKm >= 1
              ? `${formatDistance(summary.distanceKm)} between consecutive memories.`
              : 'Distance appears once two memories have coordinates.'}
          </p>
        </section>
      ) : null}
    </div>
  )
}

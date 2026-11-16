import { Suspense, lazy, type ComponentProps } from 'react'
import { Spinner } from '../../components/ui/Spinner'

const TripMap = lazy(() => import('./TripMap').then((module) => ({ default: module.TripMap })))

/**
 * Leaflet (~150 kB with its CSS) is only needed on the map screen and on an
 * entry detail page. Loading it lazily keeps the journal's first paint light,
 * and the service worker still precaches the chunk for offline use.
 */
export function LazyTripMap(props: ComponentProps<typeof TripMap>) {
  return (
    <Suspense
      fallback={
        <div className="map-loading">
          <Spinner size={22} />
        </div>
      }
    >
      <TripMap {...props} />
    </Suspense>
  )
}

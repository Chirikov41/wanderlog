import { type ComponentProps } from 'react'
import { TripMap } from './TripMap'

/**
 * Leaflet (~150 kB with its CSS) is only needed on the map screen and on an
 * entry detail page. It used to be loaded with a dynamic import so the journal's
 * first paint stayed light.
 *
 * The native Android shell inlines the whole bundle into index.html, where a
 * dynamic import resolves against the document root and the extra CSS chunk
 * cannot be preloaded. Importing eagerly keeps the map in the main chunk, so the
 * packaged app needs no request beyond the single HTML document.
 */
export function LazyTripMap(props: ComponentProps<typeof TripMap>) {
  return <TripMap {...props} />
}

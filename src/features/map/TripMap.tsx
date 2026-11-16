import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { categoryMeta } from '../../lib/categories'
import type { Entry } from '../../types'

interface TripMapProps {
  entries: Entry[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  interactive?: boolean
  className?: string
}

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/**
 * Leaflet map rendered from entry coordinates.
 *
 * Markers are `divIcon`s (plain DOM, styled by CSS) so no marker image assets
 * are needed and the category colour comes straight from lib/categories.ts.
 * The map instance is created once per mount; markers are diffed in a second
 * effect keyed by a signature of the entries.
 */
export function TripMap({
  entries,
  selectedId = null,
  onSelect,
  interactive = true,
  className,
}: TripMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const markersRef = useRef(new Map<string, L.Marker>())
  const selectRef = useRef(onSelect)

  useEffect(() => {
    selectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return

    const map = L.map(container, {
      zoomControl: false,
      attributionControl: true,
      dragging: interactive,
      touchZoom: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      keyboard: interactive,
      zoomSnap: 0.5,
    }).setView([56.49, -4.2], 6)

    L.tileLayer(TILE_URL, {
      maxZoom: 18,
      minZoom: 3,
      attribution: ATTRIBUTION,
    }).addTo(map)

    if (interactive) L.control.zoom({ position: 'topright' }).addTo(map)

    const layer = L.layerGroup().addTo(map)
    mapRef.current = map
    layerRef.current = layer

    const timer = window.setTimeout(() => map.invalidateSize(), 150)

    return () => {
      window.clearTimeout(timer)
      map.remove()
      mapRef.current = null
      layerRef.current = null
      markersRef.current.clear()
    }
  }, [interactive])

  const signature = entries
    .map(
      (entry) =>
        `${entry.id}:${entry.coords?.lat ?? ''}:${entry.coords?.lng ?? ''}:${entry.category}:${entry.title}`,
    )
    .join('|')

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    layer.clearLayers()
    markersRef.current.clear()

    const points: L.LatLngTuple[] = []

    for (const entry of entries) {
      if (!entry.coords) continue
      const meta = categoryMeta(entry.category)
      const icon = L.divIcon({
        className: 'map-pin',
        html: `<span class="map-pin__dot" style="background:${meta.colour}"></span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })

      const marker = L.marker([entry.coords.lat, entry.coords.lng], {
        icon,
        title: entry.title,
        keyboard: false,
      })

      marker.on('click', () => selectRef.current?.(entry.id))
      marker.addTo(layer)
      markersRef.current.set(entry.id, marker)
      points.push([entry.coords.lat, entry.coords.lng])
    }

    if (points.length === 1) {
      map.invalidateSize()
      map.setView(points[0], interactive ? 12 : 12)
    } else if (points.length > 1) {
      map.invalidateSize()
      map.fitBounds(L.latLngBounds(points), {
        padding: [44, 44],
        maxZoom: 13,
        animate: false,
      })
    }
    // `signature` captures every field used above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, interactive])

  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      const element = marker.getElement()
      if (!element) continue
      element.classList.toggle('is-selected', id === selectedId)
    }
  }, [selectedId, signature])

  return <div ref={containerRef} className={className ?? 'trip-map'} />
}

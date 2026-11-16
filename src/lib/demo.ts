import { createEntry } from './entries.repo'
import { createPhotoRecord } from './image'
import type { CategoryId, Coordinates, EntryDraft, PlaceInfo } from '../types'

/**
 * Sample data for the "Load sample trip" action in Settings.
 *
 * The brief asks for a mobile app that can be demonstrated end-to-end, and a
 * brand-new install has an empty journal. This seeds a small Scottish trip so a
 * marker can show the map, the stats and the photo pipeline immediately. It uses
 * the exact same repository path as a user-created memory.
 */

interface DemoSeed {
  title: string
  notes: string
  category: CategoryId
  rating: number
  place: PlaceInfo
  coords: Coordinates
  photo: string | null
  visitedAt: [number, number, number]
}

const DEMO_SEEDS: DemoSeed[] = [
  {
    title: 'Mist over the Quiraing',
    notes:
      'Walked the ridge before the cloud lifted. The old landslip looks like a folded quilt from up here — every layer of rock a different shade of green.',
    category: 'mountain',
    rating: 5,
    place: { name: 'Quiraing', region: 'Isle of Skye, Highland', country: 'Scotland' },
    coords: { lat: 57.6416, lng: -6.2654, accuracy: 8 },
    photo: 'quiraing.jpg',
    visitedAt: [2026, 5, 18],
  },
  {
    title: 'Glen Coe, after the rain',
    notes:
      'Three sisters with cloud pouring over the tops. Stopped at the viewpoint and just listened to the water coming down the hillside.',
    category: 'mountain',
    rating: 5,
    place: { name: 'Glen Coe', region: 'Highland', country: 'Scotland' },
    coords: { lat: 56.669, lng: -5.103, accuracy: 12 },
    photo: 'glencoe.jpg',
    visitedAt: [2026, 5, 21],
  },
  {
    title: 'Portobello at golden hour',
    notes:
      'The tide was miles out and the sand was still warm. Best fish supper view in Edinburgh, even with the wind.',
    category: 'coast',
    rating: 4,
    place: { name: 'Portobello Beach', region: 'Edinburgh', country: 'Scotland' },
    coords: { lat: 55.954, lng: -3.114, accuracy: 15 },
    photo: 'portobello.jpg',
    visitedAt: [2026, 6, 14],
  },
  {
    title: 'Rain on the Royal Mile',
    notes:
      'Took shelter under the arches and watched the crowds run for it. The closes look completely different when they are wet.',
    category: 'city',
    rating: 4,
    place: { name: 'Royal Mile', region: 'Edinburgh', country: 'Scotland' },
    coords: { lat: 55.95, lng: -3.188, accuracy: 20 },
    photo: 'royalmile.jpg',
    visitedAt: [2026, 7, 2],
  },
  {
    title: 'Loch an Eilein at dawn',
    notes:
      'On the water before the midges. An osprey went over twice and the island castle came out of the mist around six.',
    category: 'wildlife',
    rating: 5,
    place: { name: 'Loch an Eilein', region: 'Cairngorms', country: 'Scotland' },
    coords: { lat: 57.136, lng: -3.742, accuracy: 9 },
    photo: 'lochan.jpg',
    visitedAt: [2026, 9, 5],
  },
  {
    title: 'Fish supper on the harbour',
    notes:
      'Ate it on the wall while the ferry came in. Best batter I have had all year — worth the queue.',
    category: 'food',
    rating: 4,
    place: { name: 'Oban Harbour', region: 'Argyll', country: 'Scotland' },
    coords: { lat: 56.415, lng: -5.471, accuracy: 11 },
    photo: 'oban.jpg',
    visitedAt: [2026, 9, 8],
  },
  {
    title: 'Notes from the sleeper train',
    notes:
      'Woke up somewhere past Carlisle with the curtain half open. No photo — just the sound of the rails and a very bad coffee.',
    category: 'other',
    rating: 0,
    place: { name: 'Edinburgh Waverley', region: 'Edinburgh', country: 'Scotland' },
    coords: { lat: 55.952, lng: -3.189, accuracy: 25 },
    photo: null,
    visitedAt: [2026, 6, 30],
  },
]

export const DEMO_ENTRY_COUNT = DEMO_SEEDS.length

async function loadSeedPhoto(file: string): Promise<Blob | null> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}demo/${file}`)
    if (!response.ok) return null
    return await response.blob()
  } catch {
    return null
  }
}

export async function seedDemoTrip(
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  let created = 0

  for (const seed of DEMO_SEEDS) {
    const [year, month, day] = seed.visitedAt
    const photoBlob = seed.photo ? await loadSeedPhoto(seed.photo) : null
    const photo = photoBlob ? await createPhotoRecord(photoBlob, 'library') : null

    const draft: EntryDraft = {
      title: seed.title,
      notes: seed.notes,
      category: seed.category,
      rating: seed.rating,
      visitedAt: new Date(year, month - 1, day, 11, 30).getTime(),
      place: seed.place,
      coords: seed.coords,
      photo,
    }

    await createEntry(draft)
    created += 1
    onProgress?.(created, DEMO_SEEDS.length)
  }

  return created
}

# Architecture

This document explains how Wanderlog is put together, why each layer exists, and which trade-offs
were made. It is the technical companion to the user guide and to the Part A slide deck.

## 1. Goals and constraints

| Goal | Constraint that shaped the design |
| --- | --- |
| Works with no signal | Everything the user creates is stored locally; the app shell is precached |
| Runs on a phone, not a laptop | Single-column layout, bottom navigation, safe-area insets, 44 px targets |
| Uses real hardware | Geolocation and camera are first-class features, not add-ons |
| Data survives restarts | IndexedDB (with blobs), not `localStorage` |
| Must be explainable | No black-box state library; one repository module, one hook per API |
| Must be deployable for free | Static build, no server, hash routing, relative asset base |

## 2. Layers

```
src/
  components/        presentational: icons, header, tab bar, UI primitives
  features/<domain>/ one folder per screen or workflow
  hooks/             device APIs and browser capabilities
  lib/               domain logic and persistence
  styles/            design tokens and CSS
  types.ts           shared domain types
```

Dependencies point downwards only:

```
features/* ──▶ components/* ──▶ (nothing)
    │
    ├──▶ hooks/* ──▶ lib/* ──▶ types.ts
    └──▶ lib/*
```

`components/ui/*` never imports from `features/*`, and `lib/*` never imports React. That keeps the
pure logic testable in Node (see `tests/`).

## 3. Rendering and state

There is no Redux/Zustand store. State comes from three places:

1. **Component state** (`useState`) for form drafts, open sheets, filters and camera previews.
2. **Context** for cross-cutting values that change rarely: the theme (`ThemeProvider`) and toasts
   (`ToastProvider`).
3. **IndexedDB as the source of truth**, read through `useLiveQuery` from `dexie-react-hooks`.

```ts
// src/lib/entries.repo.ts
export function useEntries(): Entry[] | undefined {
  return useLiveQuery(() => db.entries.orderBy('visitedAt').reverse().toArray(), [])
}
```

When `createEntry`, `updateEntry` or `deleteEntry` resolves, Dexie notifies every live query whose
result set changed. The journal list, the map, the stats page and the entry detail page refresh
themselves; no component has to know who else is on screen.

`undefined` means "the first query has not resolved yet". Screens use it to render skeletons
instead of flashing an empty state.

## 4. Persistence design

### Schema

```ts
class WanderlogDatabase extends Dexie {
  entries!: Table<Entry, string>
  places!: Table<PlaceCacheRecord, string>

  constructor() {
    super('wanderlog')
    this.version(1).stores({
      entries: 'id, visitedAt, createdAt, category',
      places: 'key, fetchedAt',
    })
  }
}
```

- `id` is the primary key (UUID from `crypto.randomUUID`, with a `getRandomValues` fallback for
  insecure contexts).
- `visitedAt` is indexed because it is the journal's sort order.
- `category` is indexed for the filter chips.
- `places` is a small reverse-geocoding cache keyed by coordinates rounded to three decimals
  (~110 m), with `fetchedAt` for future eviction.

### Why IndexedDB instead of localStorage

`localStorage` is synchronous, limited to roughly 5 MB, and can only store strings. A single phone
photo would exceed the quota as a base64 string. IndexedDB stores `Blob`s natively, has a much
larger quota, and is asynchronous, so decoding and writing never block the UI thread.

### Photo pipeline

```
camera frame ──▶ canvas crop/scale (1600 px) ──▶ JPEG q=0.82 ──▶ Blob  ──┐
                                                                        ├─▶ IndexedDB
same source ──▶ canvas scale (480 px) ──▶ JPEG q=0.70 ──▶ thumbnail ────┘
```

- Re-encoding strips EXIF (including GPS coordinates) that the user may not expect to duplicate.
- Lists render the 480 px thumbnail, the detail hero renders the 1600 px version.
- Object URLs are created and revoked by `useObjectUrl`, so scrolling a long journal does not leak
  memory.
- If `createImageBitmap` is missing (older Safari), the loader falls back to an `<img>` element.

### CRUD mapping

| Operation | Repository | UI entry point |
| --- | --- | --- |
| Create | `createEntry(draft)` | `/new` → Save |
| Read | `useEntries`, `useEntry`, `listEntries` | journal, map, stats, detail |
| Update | `updateEntry(id, draft)` | `/edit/:id` → Save changes |
| Delete | `deleteEntry(id)` | detail → Delete → confirm |

`updateEntry` preserves `createdAt` and stamps `updatedAt`. Deleting the row also releases the
photo blobs because nothing else references them.

## 5. Device APIs

### Geolocation (`hooks/useGeolocation.ts`)

- Uses `watchPosition` with `enableHighAccuracy: true` so the accuracy radius tightens while the
  user holds the phone still, and so `coords.heading` updates as they turn.
- Normalises the API into `idle | locating | ready | error | unsupported` plus a human-readable
  error message for each `GeolocationPositionError.code`.
- Cleans the watch up in an effect cleanup; a screen cannot leak a running GPS subscription.

### Camera (`hooks/useCamera.ts`)

- `getUserMedia({ video: { facingMode: { ideal } } })` with a rear-camera preference.
- The stream is attached to a `<video>` by ref; the shutter draws the current frame onto a canvas
  at the video's native resolution and encodes JPEG.
- `enumerateDevices()` decides whether to show the front/rear switch.
- Every track is stopped when the sheet closes, so the camera indicator turns off.
- Fallbacks: `<input type="file" capture="environment">` for the OS camera app, and a plain image
  picker. Both paths go through the same compression function, so the stored record is identical.

### Extras

- **Device Orientation** (`useDeviceOrientation.ts`): compass heading, with the iOS 13+
  `DeviceOrientationEvent.requestPermission()` gesture requirement handled by an explicit
  "Enable" button.
- **Vibration** (`lib/haptics.ts`): short taps on capture and delete, silently ignored where
  unsupported.
- **Web Share** (`lib/share.ts`): shares title, text and (when `canShare({ files })`) the photo;
  falls back to the clipboard.

## 6. Network dependencies and offline behaviour

| Request | Strategy (Workbox) | Fallback |
| --- | --- | --- |
| App shell (`/index.html`, JS, CSS, icons, demo photos) | Precache, cache-first | Always available after first load |
| OSM tiles | `CacheFirst`, 600 entries / 30 days | Grey map background, pins still render |
| Nominatim reverse geocoding | `NetworkFirst`, 6 s timeout, 80 entries | Cached answer, otherwise the user types the name |
| Nothing else | — | — |

The app itself also caches geocoding answers in IndexedDB, keyed by rounded coordinates, and
throttles requests to one per 1.1 s to respect the Nominatim usage policy. The in-flight map
deduplicates concurrent lookups for the same coordinate.

## 7. PWA details

- `registerType: 'prompt'` — a new deployment waits in the background until the user accepts the
  in-app banner, instead of reloading mid-entry.
- `navigateFallback: 'index.html'` keeps deep links working offline; hash routing means the server
  never sees a sub-path anyway.
- `base: './'` makes the identical build work at `/`, `/wanderlog/` (GitHub Pages) or
  `/some-preview-url/`.
- Manifest: standalone display, portrait orientation, maskable icon, theme colour, `start_url: '.'`.
- Install is offered in Settings; `beforeinstallprompt` is captured and replayed on demand, with
  iOS instructions when the event never fires.

## 8. Performance

- Route-level code splitting: Leaflet (≈150 kB JS + 15 kB CSS) is loaded lazily by
  `LazyTripMap`, so the journal's first paint does not wait for the map.
- Photos are decoded once upstream and served from object URLs; lists use thumbnails.
- `content-visibility` is not used (Safari support), but cards are simple, and long lists stay
  smooth because each card only decodes one 480 px image.
- Production build: ~442 kB JS (141 kB gzip) for the app shell, ~152 kB (44 kB gzip) for the map
  chunk, ~35 kB CSS (8 kB gzip).

## 9. Accessibility and UX details

- Visible `:focus-visible` rings, a skip link, `aria-pressed` on chips and rating stars,
  `aria-modal` dialogs, `role="status"` toasts, labelled icon buttons.
- `prefers-reduced-motion` disables page, sheet and shimmer animations.
- `prefers-color-scheme` is honoured by the "Auto" theme; the explicit choice is stored in
  `localStorage`.
- Minimum 44 px touch targets, safe-area padding for notches and the iOS home indicator.
- Empty states explain what will happen next rather than only saying "no data".

## 10. Known limitations and deliberate trade-offs

| Limitation | Reason | Possible fix |
| --- | --- | --- |
| Distance is straight-line, not routed | No routing service, and offline routing is heavy | Add a routing API with cached results |
| Map tiles need a network connection the first time | Tile providers do not allow bulk pre-download | Offer a small offline basemap for a chosen area |
| No cloud sync | The brief rewards on-device storage and offline reliability | Optional sync layer (Supabase/Firebase) behind an account |
| English-only UI | Single-user coursework build | `i18next` and message extraction |
| Single user / no auth | Everything is local, so there is nothing to protect | Not needed unless sync is added |
| Nominatim rate limits | Shared public service | Self-host or use a paid geocoder for production |

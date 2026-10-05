# `@osm-editor-kit/street-imagery`

> [!NOTE]
> This package is an **alpha** release and still under active development. APIs may change; install with the npm `alpha` dist-tag.

## What it does

- Talk to many street-photo providers through one adapter API (Mapillary, Panoramax, KartaView, Mapilio, Bing Streetside, Vegbilder, Google Street View, Apple Look Around, …)
- Normalize photos, sequences, and map features into shared types
- Fetch by map bbox or MVT tiles
- Build GeoJSON for map layers (points, sequences, viewfields)
- Filter by date and photo type (flat / panorama)
- Helpers for deep links, nearby-photo grouping, and thumbnails

For MapLibre React layers, use `@osm-editor-kit/street-imagery-react`.

## Usage

```ts
import {
  createStreetImageryConfig,
  photosToFeatureCollection,
  registerProviderAdapters,
  setStreetImageryConfig,
} from '@osm-editor-kit/street-imagery'
import { mapillaryAdapter } from '@osm-editor-kit/street-imagery/providers/mapillary'

setStreetImageryConfig(createStreetImageryConfig({ mapillaryToken: '…' }))
registerProviderAdapters([mapillaryAdapter])

const bbox = [13.44, 52.47, 13.45, 52.48] as const // west, south, east, north
const controller = new AbortController()
const photos = await mapillaryAdapter.fetchPhotos!(bbox, 16, controller.signal)
const geojson = photosToFeatureCollection(photos)
```

### Only bundle the providers you use

Each provider's fetching code is its own entry. Register the ones your app shows; the others are
not bundled.

| Entry                                | Adapter                                   |
| ------------------------------------ | ----------------------------------------- |
| `…/providers/mapillary`              | `mapillaryAdapter` (photos and sequences) |
| `…/providers/mapillary-signs`        | `mapillarySignsAdapter`                   |
| `…/providers/mapillary-map-features` | `mapillaryMapFeaturesAdapter`             |
| `…/providers/panoramax`              | `panoramaxAdapter`                        |
| `…/providers/kartaview`              | `kartaviewAdapter`                        |
| `…/providers/mapilio`                | `mapilioAdapter`                          |
| `…/providers/streetside`             | `streetsideAdapter` (needs `bingMapsKey`) |
| `…/providers/vegbilder`              | `vegbilderAdapter`                        |
| `…/providers/all`                    | `ALL_PROVIDER_ADAPTERS`                   |

Names, colours and zoom limits of all providers (`PROVIDERS`, `providerById`) and the "open in …"
links (`getLocationOpeners()`) need no adapter. Google Street View and Apple Look Around have no
adapter: they show nothing on the map.

## Mapillary: images, map features, detections

Everything below needs only the Mapillary token from `setStreetImageryConfig`.

```ts
import {
  ageBand, // 'outdated' | 'old' | 'mid' | 'new', relative to a cutoff date
  ageBandColorExpression, // MapLibre color expression on `capturedAt`
  bboxAround,
  countByGroup,
  fetchImageDetections, // outlines of what Mapillary detected in one image
  fetchMapFeatureImages, // a sign/object with all images that show it, grouped by day
  fetchMapillaryImages, // dates, 360° flag, username, both positions for image ids
  fetchMapillaryMapFeaturesInBbox,
  JUNCTION_DETECTION_GROUPS, // bike-lane surface, line markings, hatching, …
  JUNCTION_FEATURE_GROUPS, // traffic lights, bicycle symbols, stop lines, arrows, crosswalks
  mapillaryImagesOfTags, // image ids in OSM tags (`mapillary`, `cycleway:right:mapillary`, …)
  matchesAnyGroup,
  SIGN_GROUPS, // parking, bike, speed, access (and `other` for the rest)
  signGroupFilter, // `['parking', 'bike']` → `filter.mapFeatureValue` of the map layers
  targetImageToPhoto, // a TargetImage as the Mapillary photo to show
} from '@osm-editor-kit/street-imagery'

// What is at this junction?
const features = await fetchMapillaryMapFeaturesInBbox(bboxAround([13.4184, 52.4992], 40), {
  objectValues: ['object--traffic-light--*', 'marking--discrete--*'],
})
countByGroup(features, JUNCTION_FEATURE_GROUPS) // { 'traffic-light': 12, 'stop-line': 3, … }

// Which photos show this sign, and which one is best?
const sign = await fetchMapFeatureImages(featureId)
sign?.days[0]?.best // newest day's best image; `outline` when Mapillary linked one

// Only the outlines you care about (an image has ~500 detections).
await fetchImageDetections(imageId, { filter: matchesAnyGroup(JUNCTION_DETECTION_GROUPS) })
```

- **Target view math** (`targetView.ts`): `bestTargetImage`, `targetImagesByDay`, `viewFromOutline`, `viewFromLocation`, `viewFromFlatCamera`. `SIGN_TARGET` and `PLACE_TARGET` describe how big and how high a target is; use `PLACE_TARGET` to look at a junction.
- **Two positions per image**: `lngLat` is Mapillary's computed position (map features are located from it), `originalLngLat` the camera's GPS position. Computed matches detections better but is sometimes far off.
- **Own captures**: photos carry `creatorId` and `organizationId`; `createMapillaryHighlightResolver` resolves usernames and organization slugs to them.
- **No surface colour**: Mapillary has no colour attribute on features or detections.

## Age colors

`createAgeSteps()` splits photo age into fixed steps from a time: older than 4 years, 2–4 years, newer than 2 years (TILDA palette). Thresholds are `years` or exact times (`starts`), colors and ids are options; use it where a project needs specific dates. `ageStepColorExpression(steps, { property })` is the MapLibre `circle-color` (`capturedAt` for photos, `lastSeenAt` for map features), `ageStepMatchExpression` and `countByAgeStep` serve legends. `MAX_USEFUL_AGE_YEARS` (4) is the age beyond which photos are rarely useful; hosts can hide them by default. For steps that follow a "from" filter instead, use `ageBandColorExpression`.

```ts
const steps = createAgeSteps({ now: LOADED_AT }) // or { starts: [Date.UTC(2023, 0, 1)] }
const photoCircleColor = ageStepColorExpression(steps)
```

## Viewpoints and other providers

`viewpointFromPoint`, `viewpointsFromLine`, `viewpointsIntoNode` build viewpoints; `rankPhotosForDirection` ranks photos per view direction. Photos come from a `ViewpointPhotoSource` (`{ id, fetchNear }`): `mapillaryPhotoSource` and `streetViewPhotoSource` ship with the package (Street View needs `googleMapsApiKey` in the config; the package reads no env vars). Write your own source for other providers, e.g. Infra3D.

## Open a place in another service

`getLocationOpeners()` / `findLocationOpener(id)` give one opener per service, `getLocationOpenersAt(lngLat)` only those with imagery at a place (`opener.covers(lngLat)`: Vegbilder only in Norway, an infra3D project only in its `bbox`): the photo providers (`LOCATION_OPENERS`) plus one per configured infra3D project (id `infra3d:<project uid>`). Each has `locationUrl(target)`, a plain link that works as an `<a href>`, and where the service allows it `lookAtUrl(target)`, which finds the nearest image and turns it to the place (Mapillary; Google Street View with `googleMapsApiKey`). `openLocationInNewTab(opener, target)` opens the tab first and then resolves the look-at link, so popup blockers let it through; call it directly in a click handler. A `dateFrom` in the target (`YYYY-MM-DD`) limits Mapillary to photos from that day on, in the plain link and the look-at link; the other services have no such link param. A value that is not a real day throws (`isIsoDate`, `assertIsoDate`). The links need no config; the Panoramax ones go to the public server unless the config names another (`getPanoramaxApiBase()`).

```ts
import { findLocationOpener, openLocationInNewTab } from '@osm-editor-kit/street-imagery'

const opener = findLocationOpener('mapillary')
if (opener)
  openLocationInNewTab(opener, { lngLat: [13.38886, 52.51704], zoom: 17, dateFrom: '2023-10-05' })
```

**infra3D** has no public coverage data, so it is an opener only, and the package knows no projects: the host names them, `createStreetImageryConfig({ infra3d: { projects: [{ uid, label, bbox }] } })`. Each project gets its own opener with that `label`. With a `bbox` the opener covers only that area. `buildInfra3dUrl` builds the three link kinds (`jumpTo`, `lookAt`, `imageKey` with optional `pointTo`; they exclude each other). The opener uses `lookAt` without a height: infra3D then looks at the ground at that point from the nearest image (within 100 m). Only people with an infra3D account get past its login page. Its openers have `requiresAccount: true` (all others `false`), so a host can mark the link, e.g. with a lock icon.

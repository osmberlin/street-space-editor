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
  adapterById,
  createStreetImageryConfig,
  photosToFeatureCollection,
  setStreetImageryConfig,
} from '@osm-editor-kit/street-imagery'

setStreetImageryConfig(createStreetImageryConfig({ mapillaryToken: '…' }))

const bbox = [13.44, 52.47, 13.45, 52.48] as const // west, south, east, north
const controller = new AbortController()
const photos = await adapterById.mapillary.fetchPhotos!(bbox, 16, controller.signal)
const geojson = photosToFeatureCollection(photos)
```

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
  SIGN_GROUPS, // bike, speed, access
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

## Viewpoints and other providers

`viewpointFromPoint`, `viewpointsFromLine`, `viewpointsIntoNode` build viewpoints; `rankPhotosForDirection` ranks photos per view direction. Photos come from a `ViewpointPhotoSource` (`{ id, fetchNear }`): `mapillaryPhotoSource` and `streetViewPhotoSource` ship with the package (Street View needs `googleMapsApiKey` in the config; the package reads no env vars). Write your own source for other providers, e.g. Infra3D.

## Open a place in another service

`getLocationOpeners()` / `findLocationOpener(id)` give one opener per service: the photo providers (`LOCATION_OPENERS`) plus one per configured infra3D project (id `infra3d:<project uid>`). Each has `locationUrl(target)`, a plain link that works as an `<a href>`, and where the service allows it `lookAtUrl(target)`, which finds the nearest image and turns it to the place (Mapillary; Google Street View with `googleMapsApiKey`). `openLocationInNewTab(opener, target)` opens the tab first and then resolves the look-at link, so popup blockers let it through; call it directly in a click handler.

```ts
import { findLocationOpener, openLocationInNewTab } from '@osm-editor-kit/street-imagery'

const opener = findLocationOpener('mapillary')
if (opener) openLocationInNewTab(opener, { lngLat: [13.38886, 52.51704], zoom: 17 })
```

**infra3D** has no public coverage data, so it is an opener only and needs projects: `createStreetImageryConfig({ infra3d: { projects: [{ uid, name }] } })`. Each project gets its own opener, labelled "infra3D <name>". `buildInfra3dUrl` builds the three link kinds (`jumpTo`, `lookAt`, `imageKey` with optional `pointTo`; they exclude each other). The opener uses `lookAt` without a height: infra3D then looks at the ground at that point from the nearest image (within 100 m). Only people with an infra3D account get past its login page.

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
